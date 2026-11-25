import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, dateInvitesTable, matchesTable, messagesTable, profilesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { broadcastToMatch } from "../lib/ws-manager.js";

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

export default router;
