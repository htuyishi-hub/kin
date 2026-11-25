import { Router } from "express";
import { eq, and, or, gt, desc } from "drizzle-orm";
import { db, dateInvitesTable, matchesTable, messagesTable, profilesTable, dateLocationSessionsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { broadcastToMatch } from "../lib/ws-manager.js";
import { haversineKm } from "../lib/geo.js";

const router = Router();

export const CURATED_DATE_SPOTS = [
  { id: "question_coffee", name: "Question Coffee", area: "Gishushu", emoji: "☕" },
  { id: "rubia_roasters", name: "Rubia Coffee Roasters", area: "Kimihurura", emoji: "☕" },
  { id: "inka_steakhouse", name: "Inka Steakhouse", area: "Kimihurura", emoji: "🍸" },
  { id: "kigali_heights", name: "Kigali Heights Rooftop", area: "Kacyiru", emoji: "🌇" },
  { id: "sole_luna", name: "Sole Luna", area: "Gikondo", emoji: "🍕" },
  { id: "huye_hub", name: "Huye Campus Hub", area: "UR Huye", emoji: "🎓" },
];

// GET /dates/spots — Curated Kigali & Huye date spots
router.get("/dates/spots", requireAuth, (_req, res) => {
  res.json(CURATED_DATE_SPOTS);
});

// POST /matches/:matchId/date-invite — Send a curated date spot invitation
router.post("/matches/:matchId/date-invite", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;
  const { spotName, spotArea, proposedTime } = req.body as {
    spotName?: string;
    spotArea?: string;
    proposedTime?: string;
  };

  if (!spotName || !proposedTime) {
    res.status(400).json({ error: "bad_request", message: "spotName and proposedTime are required" });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(and(eq(matchesTable.id, String(matchId)), or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId))))
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found" });
    return;
  }

  const recipientId = match.userA === userId ? match.userB : match.userA;
  const area = spotArea || "Kigali";

  const [invite] = await db
    .insert(dateInvitesTable)
    .values({
      matchId: String(matchId),
      senderId: userId,
      recipientId,
      spotName,
      spotArea: area,
      proposedTime,
      status: "pending",
    })
    .returning();

  const [msg] = await db
    .insert(messagesTable)
    .values({
      matchId: String(matchId),
      senderId: userId,
      content: `📍 ${spotName} (${area}) · ${proposedTime}`,
      phase: (match.conversationPhase ?? 1) as any,
      mediaType: "date_invite",
      mediaUrl: invite!.id,
      gameData: {
        question: `${spotName} (${area}) · ${proposedTime}`,
        answers: { status: "pending", inviteId: invite!.id },
      },
      isSystem: false,
    })
    .returning();

  const mapped = {
    id: msg!.id,
    matchId: msg!.matchId,
    senderId: msg!.senderId,
    content: msg!.content,
    phase: msg!.phase,
    isSystem: false,
    mediaType: "date_invite",
    mediaUrl: invite!.id,
    reactions: {},
    gameData: (msg as any).gameData,
    createdAt: msg!.createdAt?.toISOString() ?? new Date().toISOString(),
  };

  broadcastToMatch(String(matchId), { type: "new_message", message: mapped });
  res.status(201).json({ invite, message: mapped });
});

// POST /matches/:matchId/date-invite/respond — Accept or decline date invite
router.post("/matches/:matchId/date-invite/respond", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;
  const { inviteId, action } = req.body as { inviteId?: string; action?: "accept" | "decline" };

  if (!inviteId || (action !== "accept" && action !== "decline")) {
    res.status(400).json({ error: "bad_request", message: "inviteId and valid action are required" });
    return;
  }

  const status = action === "accept" ? "accepted" : "declined";
  const [updated] = await db
    .update(dateInvitesTable)
    .set({ status })
    .where(and(eq(dateInvitesTable.id, inviteId), eq(dateInvitesTable.matchId, String(matchId))))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Invite not found" });
    return;
  }

  const [msg] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.matchId, String(matchId)), eq(messagesTable.mediaUrl, inviteId)))
    .limit(1);

  if (msg) {
    const newGameData = {
      question: `${updated.spotName} (${updated.spotArea}) · ${updated.proposedTime}`,
      answers: { status, inviteId, respondedBy: userId },
    };
    await db
      .update(messagesTable)
      .set({ gameData: newGameData as any })
      .where(eq(messagesTable.id, msg.id));

    broadcastToMatch(String(matchId), {
      type: "game_updated",
      matchId: String(matchId),
      messageId: msg.id,
      gameData: newGameData,
    });
  }

  res.json({ success: true, status, invite: updated });
});

// GET /dates/:inviteId/share-card — Safe date details for sharing with Bestie
router.get("/dates/:inviteId/share-card", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const inviteId = String(req.params["inviteId"] ?? "");

  const [invite] = await db
    .select()
    .from(dateInvitesTable)
    .where(eq(dateInvitesTable.id, inviteId))
    .limit(1);

  if (!invite) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const partnerId = invite.senderId === userId ? invite.recipientId : invite.senderId;
  const [partner] = await db
    .select({
      fullName: profilesTable.fullName,
      isVerified: profilesTable.isVerified,
      verificationStatus: profilesTable.verificationStatus,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, partnerId))
    .limit(1);

  res.json({
    partnerName: partner?.fullName?.trim().split(" ")[0] ?? "kinn Member",
    spotName: `${invite.spotName} (${invite.spotArea})`,
    time: invite.proposedTime,
    verifiedBadge: Boolean(partner?.isVerified || partner?.verificationStatus === "verified"),
    link: `https://kinn.ink/p/${partnerId}`,
  });
});

// POST /matches/:matchId/location/share — Share live GPS for 1-2 hours during date
router.post("/matches/:matchId/location/share", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const matchId = String(req.params["matchId"] ?? "");
  const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };

  if (typeof latitude !== "number" || typeof longitude !== "number" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({ error: "invalid_coordinates" });
    return;
  }

  await db
    .update(dateLocationSessionsTable)
    .set({ isActive: false })
    .where(and(eq(dateLocationSessionsTable.matchId, matchId), eq(dateLocationSessionsTable.userId, userId)));

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const [created] = await db
    .insert(dateLocationSessionsTable)
    .values({
      matchId,
      userId,
      latitude,
      longitude,
      isActive: true,
      expiresAt,
    })
    .returning();

  broadcastToMatch(matchId, {
    type: "location_updated",
    matchId,
    userId,
    latitude,
    longitude,
  } as any);

  res.json({ success: true, session: created });
});

// GET /matches/:matchId/location — Get active live date locations & real Haversine ETA
router.get("/matches/:matchId/location", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const matchId = String(req.params["matchId"] ?? "");
  const now = new Date();

  const rows = await db
    .select()
    .from(dateLocationSessionsTable)
    .where(
      and(
        eq(dateLocationSessionsTable.matchId, matchId),
        eq(dateLocationSessionsTable.isActive, true),
        gt(dateLocationSessionsTable.expiresAt, now)
      )
    )
    .orderBy(desc(dateLocationSessionsTable.createdAt));

  const myLoc = rows.find((r) => r.userId === userId) ?? null;
  const partnerLoc = rows.find((r) => r.userId !== userId) ?? null;

  let distanceMeters: number | null = null;
  let etaMinutes: number | null = null;
  if (myLoc && partnerLoc) {
    distanceMeters = Math.round(haversineKm(myLoc.latitude, myLoc.longitude, partnerLoc.latitude, partnerLoc.longitude) * 1000);
    etaMinutes = Math.max(1, Math.round(distanceMeters / 80));
  }

  res.json({
    myLocation: myLoc ? { latitude: myLoc.latitude, longitude: myLoc.longitude, createdAt: myLoc.createdAt } : null,
    partnerLocation: partnerLoc ? { latitude: partnerLoc.latitude, longitude: partnerLoc.longitude, createdAt: partnerLoc.createdAt } : null,
    distanceMeters,
    etaMinutes,
  });
});

// POST /matches/:matchId/location/stop — Stop sharing live location
router.post("/matches/:matchId/location/stop", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const matchId = String(req.params["matchId"] ?? "");
  await db
    .update(dateLocationSessionsTable)
    .set({ isActive: false })
    .where(and(eq(dateLocationSessionsTable.matchId, matchId), eq(dateLocationSessionsTable.userId, userId)));
  res.json({ success: true });
});

export default router;
