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

  const isVerifiedActive =
    profile[0].isVerified === true &&
    profile[0].accountStatus === "active" &&
    profile[0].profileActive !== false &&
    profile[0].profilePaused !== true;

  if (!isVerifiedActive) {
    res.json({
      inviteCode: null,
      inviteLink: null,
      inviteCount: 0,
      invitedMembers: [],
    });
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

// Rate limiting store for invite claims: 10 attempts per hour per user and per IP
const inviteClaimRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkAndIncrementInviteRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = inviteClaimRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    inviteClaimRateLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count += 1;
  return true;
}

// GET /invites/validate/:code — public check for an invite link
router.get("/invites/validate/:code", async (req, res) => {
  const { code } = req.params;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "bad_request", code: "INVITE_CODE_REQUIRED", message: "Code is required" });
    return;
  }

  const normalized = code.trim().toUpperCase();
  const inviter = await db
    .select({
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      campusName: profilesTable.campusName,
      isVerified: profilesTable.isVerified,
      accountStatus: profilesTable.accountStatus,
      profileActive: profilesTable.profileActive,
      profilePaused: profilesTable.profilePaused,
    })
    .from(profilesTable)
    .where(eq(profilesTable.inviteCode, normalized))
    .limit(1);

  if (!inviter[0]) {
    res.status(404).json({ valid: false, code: "INVITE_INVALID", message: "Invalid or expired invite code" });
    return;
  }

  if (
    inviter[0].isVerified !== true ||
    inviter[0].accountStatus !== "active" ||
    inviter[0].profileActive === false ||
    inviter[0].profilePaused === true
  ) {
    res.status(400).json({
      valid: false,
      code: "INVITE_OWNER_NOT_ACTIVE",
      message: "This invite code is not currently active.",
    });
    return;
  }

  const maxClaims = parseInt(process.env.INVITE_MAX_CLAIMS || "5", 10);
  const [claimCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invitesTable)
    .where(and(eq(invitesTable.inviterId, inviter[0].id), eq(invitesTable.status, "accepted")));

  if (Number(claimCount?.count ?? 0) >= maxClaims) {
    res.status(400).json({
      valid: false,
      code: "INVITE_MAX_CLAIMS_REACHED",
      message: "This invite code has reached its maximum number of uses.",
    });
    return;
  }

  res.json({
    valid: true,
    inviterName: inviter[0].fullName ?? "A kinn Member",
    campusName: inviter[0].campusName ?? null,
  });
});

// POST /invites/claim — claim an invite code and become verified
router.post("/invites/claim", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { code } = req.body as { code?: string };

  // Rate-limit: 10 per hour per user and per IP (uses req.ip with trust proxy support)
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";

  const userAllowed = checkAndIncrementInviteRateLimit(`user:${userId}`);
  const ipAllowed = checkAndIncrementInviteRateLimit(`ip:${clientIp}`);

  if (!userAllowed || !ipAllowed) {
    res.status(429).json({
      error: "too_many_requests",
      code: "INVITE_RATE_LIMITED",
      message: "Too many attempts. Please try again later.",
    });
    return;
  }

  if (!code || typeof code !== "string" || !code.trim()) {
    res.status(400).json({ error: "bad_request", code: "INVITE_CODE_REQUIRED", message: "Invite code is required" });
    return;
  }

  const normalized = code.trim().toUpperCase();

  // Find inviter by code (trimmed whitespace and case-insensitive)
  const inviter = await db
    .select()
    .from(profilesTable)
    .where(sql`upper(trim(${profilesTable.inviteCode})) = ${normalized}`)
    .limit(1);

  if (!inviter[0]) {
    res.status(404).json({ error: "not_found", code: "INVITE_INVALID", message: "Invalid invite code" });
    return;
  }

  if (inviter[0].id === userId) {
    res.status(400).json({ error: "bad_request", code: "INVITE_OWN_CODE", message: "You cannot claim your own invite code" });
    return;
  }

  // Get current user profile
  const me = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (!me[0]) {
    res.status(404).json({ error: "not_found", code: "USER_NOT_FOUND", message: "Profile not found" });
    return;
  }

  if (me[0].invitedByProfile) {
    res.status(400).json({ error: "already_claimed", code: "INVITE_ALREADY_CLAIMED", message: "You have already claimed an invite" });
    return;
  }

  // Check INVITE_MAX_CLAIMS (env, default 5, counted from existing invites table)
  const maxClaims = parseInt(process.env.INVITE_MAX_CLAIMS || "5", 10);
  const [claimCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invitesTable)
    .where(and(eq(invitesTable.inviterId, inviter[0]!.id), eq(invitesTable.status, "accepted")));

  if (Number(claimCount?.count ?? 0) >= maxClaims) {
    res.status(400).json({
      error: "limit_reached",
      code: "INVITE_MAX_CLAIMS_REACHED",
      message: "This invite code has reached its maximum number of uses.",
    });
    return;
  }

  try {
    // Atomic update within transaction
    await db.transaction(async (tx) => {
      // 1. Verify inviter is active, verified, not banned, and not paused inside the same transaction
      const [inviterRecord] = await tx
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, inviter[0]!.id))
        .limit(1);

      if (
        !inviterRecord ||
        inviterRecord.isVerified !== true ||
        inviterRecord.accountStatus !== "active" ||
        inviterRecord.profileActive === false ||
        inviterRecord.profilePaused === true
      ) {
        throw new Error("INVITER_NOT_ACTIVE");
      }

      // 2. Mutual claim / invite loop detection (check if inviter's ancestor chain contains userId)
      let currInviterId: string | null = inviterRecord.invitedByProfile;
      let depth = 0;
      while (currInviterId && depth < 10) {
        if (currInviterId === userId) {
          throw new Error("MUTUAL_INVITE_LOOP");
        }
        const [parent] = await tx
          .select({ invitedByProfile: profilesTable.invitedByProfile })
          .from(profilesTable)
          .where(eq(profilesTable.id, currInviterId))
          .limit(1);
        currInviterId = parent?.invitedByProfile ?? null;
        depth++;
      }

      // 3. Re-verify claim count limit inside transaction
      const [txClaimCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(invitesTable)
        .where(and(eq(invitesTable.inviterId, inviterRecord.id), eq(invitesTable.status, "accepted")));

      if (Number(txClaimCount?.count ?? 0) >= maxClaims) {
        throw new Error("MAX_CLAIMS_REACHED");
      }

      // 4. Assign an invite code upon verification if user doesn't already have one
      const newInviteCode = me[0]!.inviteCode ?? generateInviteCode();

      // Update user profile to mark verified and active
      await tx
        .update(profilesTable)
        .set({
          invitedByProfile: inviterRecord.id,
          isVerified: true,
          accountStatus: "active",
          verificationMethod: "invite",
          inviteCode: newInviteCode,
          trustScore: Math.min(100, (me[0]!.trustScore ?? 50) + 15),
        } as any)
        .where(eq(profilesTable.id, userId));

      // Update inviter's inviteCount and trust score
      await tx
        .update(profilesTable)
        .set({
          inviteCount: sql`${profilesTable.inviteCount} + 1`,
          trustScore: Math.min(100, (inviterRecord.trustScore ?? 50) + 10),
        } as any)
        .where(eq(profilesTable.id, inviterRecord.id));

      // Record in invites table
      await tx.insert(invitesTable).values({
        inviterId: inviterRecord.id,
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
          sourceId: inviterRecord.id,
        },
        {
          userId: inviterRecord.id,
          eventType: "successful_invite",
          delta: 10 as any,
          sourceId: userId,
        },
      ]);
    });
  } catch (err: any) {
    if (err?.message === "INVITER_NOT_ACTIVE") {
      res.status(400).json({
        error: "invalid_inviter",
        code: "INVITE_OWNER_NOT_ACTIVE",
        message: "This invite code is not currently active.",
      });
      return;
    }
    if (err?.message === "MUTUAL_INVITE_LOOP") {
      res.status(400).json({
        error: "mutual_loop",
        code: "INVITE_MUTUAL_LOOP",
        message: "Mutual invite loops are not allowed.",
      });
      return;
    }
    if (err?.message === "MAX_CLAIMS_REACHED") {
      res.status(400).json({
        error: "limit_reached",
        code: "INVITE_MAX_CLAIMS_REACHED",
        message: "This invite code has reached its maximum number of uses.",
      });
      return;
    }
    throw err;
  }

  res.json({
    success: true,
    isVerified: true,
    inviterName: inviter[0].fullName ?? "A kinn Member",
    message: "Invite accepted! Your account is now verified.",
  });
});

export default router;
