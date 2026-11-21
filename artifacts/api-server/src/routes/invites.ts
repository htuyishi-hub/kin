import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, profilesTable, invitesTable, trustEventsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { generateInviteCode } from "../lib/inviteCode.js";

const router = Router();

// GET /invites/my-code — returns user's invite code and link
router.get("/invites/my-code", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  let profile = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (!profile[0]) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  let inviteCode = profile[0].inviteCode;
  if (!inviteCode) {
    inviteCode = generateInviteCode();
    await db.update(profilesTable).set({ inviteCode }).where(eq(profilesTable.id, userId));
  }

  // Count accepted invites
  const acceptedInvites = await db
    .select({
      id: invitesTable.id,
      invitedUserId: invitesTable.invitedUserId,
      createdAt: invitesTable.createdAt,
      acceptedAt: invitesTable.acceptedAt,
      invitedName: profilesTable.fullName,
    })
    .from(invitesTable)
    .leftJoin(profilesTable, eq(invitesTable.invitedUserId, profilesTable.id))
    .where(and(eq(invitesTable.inviterId, userId), eq(invitesTable.status, "accepted")));

  const baseUrl = process.env["APP_URL"] ?? "https://kin.rw";
  const inviteLink = `${baseUrl}/invite/${inviteCode}`;

  res.json({
    inviteCode,
    inviteLink,
    inviteCount: profile[0].inviteCount ?? acceptedInvites.length,
    invitedMembers: acceptedInvites.map((i) => ({
      id: i.id,
      name: i.invitedName ?? "Verified Member",
      acceptedAt: i.acceptedAt?.toISOString() ?? i.createdAt?.toISOString(),
    })),
  });
});

// GET /invites/validate/:code — public check for an invite link
router.get("/invites/validate/:code", async (req, res) => {
  const { code } = req.params;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "bad_request", message: "Code is required" });
    return;
  }

  const normalized = code.trim().toUpperCase();
  const inviter = await db
    .select({
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      campusName: profilesTable.campusName,
    })
    .from(profilesTable)
    .where(eq(profilesTable.inviteCode, normalized))
    .limit(1);

  if (!inviter[0]) {
    res.status(404).json({ valid: false, message: "Invalid or expired invite code" });
    return;
  }

  res.json({
    valid: true,
    inviterName: inviter[0].fullName ?? "A Kin Member",
    campusName: inviter[0].campusName ?? null,
  });
});

// POST /invites/claim — claim an invite code and become verified
router.post("/invites/claim", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { code } = req.body as { code?: string };

  if (!code || typeof code !== "string" || !code.trim()) {
    res.status(400).json({ error: "bad_request", message: "Invite code is required" });
    return;
  }

  const normalized = code.trim().toUpperCase();

  // Find inviter by code
  const inviter = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.inviteCode, normalized))
    .limit(1);

  if (!inviter[0]) {
    res.status(404).json({ error: "not_found", message: "Invalid invite code" });
    return;
  }

  if (inviter[0].id === userId) {
    res.status(400).json({ error: "bad_request", message: "You cannot claim your own invite code" });
    return;
  }

  // Get current user profile
  const me = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (!me[0]) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  if (me[0].invitedByProfile) {
    res.status(400).json({ error: "already_claimed", code: "INVITE_ALREADY_CLAIMED", message: "You have already claimed an invite" });
    return;
  }

  // Atomic update within transaction
  await db.transaction(async (tx) => {
    // Update user profile to mark verified
    await tx
      .update(profilesTable)
      .set({
        invitedByProfile: inviter[0]!.id,
        isVerified: true,
        verificationMethod: "invite",
        trustScore: Math.min(100, (me[0]!.trustScore ?? 50) + 15),
      } as any)
      .where(eq(profilesTable.id, userId));

    // Update inviter's inviteCount and trust score
    await tx
      .update(profilesTable)
      .set({
        inviteCount: sql`${profilesTable.inviteCount} + 1`,
        trustScore: Math.min(100, (inviter[0]!.trustScore ?? 50) + 10),
      } as any)
      .where(eq(profilesTable.id, inviter[0]!.id));

    // Record in invites table
    await tx.insert(invitesTable).values({
      inviterId: inviter[0]!.id,
      invitedUserId: userId,
      inviteCode: normalized,
      status: "accepted",
      acceptedAt: new Date(),
    });

    // Audit trust events
    await tx.insert(trustEventsTable).values([
      {
        userId,
        eventType: "invited_by_member",
        delta: 15 as any,
        sourceId: inviter[0]!.id,
      },
      {
        userId: inviter[0]!.id,
        eventType: "successful_invite",
        delta: 10 as any,
        sourceId: userId,
      },
    ]);
  });

  res.json({
    success: true,
    isVerified: true,
    inviterName: inviter[0].fullName ?? "A Kin Member",
    message: "Invite accepted! Your account is now verified.",
  });
});

export default router;
