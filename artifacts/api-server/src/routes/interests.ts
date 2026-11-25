import { Router } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import { db, interestsTable, matchesTable, profilesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { getSwipeStatus } from "../lib/swipes.js";

const router = Router();

const VALID_REACTIONS = ["campus", "coffee", "serious"] as const;
type ReactionType = typeof VALID_REACTIONS[number];

// POST /interests — Categorized 'Silent' Like & Golden Bid
router.post("/interests", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { toUserId, reactionType, isGoldenBid } = req.body as {
    toUserId?: string;
    reactionType?: string;
    isGoldenBid?: boolean;
    // Strictly forbid user-generated text comments
    comment?: unknown;
    text?: unknown;
    message?: unknown;
  };

  // Anti-Harassment Rule: strictly reject text comments on teaser profiles
  if (req.body.comment || req.body.text || req.body.message) {
    res.status(400).json({
      error: "forbidden_comment",
      message: "Text comments on teaser profiles are strictly forbidden. Use vibe reactions only.",
    });
    return;
  }

  if (!toUserId) {
    res.status(400).json({ error: "bad_request", message: "toUserId is required" });
    return;
  }

  if (toUserId === userId) {
    res.status(400).json({ error: "bad_request", message: "Cannot express interest in yourself" });
    return;
  }

  const swipeStatus = await getSwipeStatus(userId);
  if (swipeStatus.remaining <= 0) {
    res.status(429).json({
      code: "SWIPE_DAILY_LIMIT",
      error: "rate_limited",
      message: "Daily swipe limit reached.",
      ...swipeStatus,
    });
    return;
  }

  const selectedReaction: ReactionType = VALID_REACTIONS.includes(reactionType as any)
    ? (reactionType as ReactionType)
    : "campus";

  const goldenBidActive = Boolean(isGoldenBid);

  // If Golden Bid is requested, verify consumable balance
  if (goldenBidActive) {
    const [userProfile] = await db
      .select({ goldenBidsRemaining: profilesTable.goldenBidsRemaining })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);

    const bids = userProfile?.goldenBidsRemaining ?? 0;
    if (bids <= 0) {
      res.status(402).json({
        error: "insufficient_golden_bids",
        message: "You have no Golden Bids remaining. Refill your balance to boost your profile to the top.",
      });
      return;
    }

    // Deduct one Golden Bid
    await db
      .update(profilesTable)
      .set({ goldenBidsRemaining: sql`GREATEST(0, COALESCE(${profilesTable.goldenBidsRemaining}, 0) - 1)` })
      .where(eq(profilesTable.id, userId));
  }

  // Check duplicate interest
  const existing = await db
    .select()
    .from(interestsTable)
    .where(and(eq(interestsTable.fromUser, userId), eq(interestsTable.toUser, toUserId)))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "duplicate", message: "Already expressed interest in this person" });
    return;
  }

  await db.insert(interestsTable).values({
    fromUser: userId,
    toUser: toUserId,
    reactionType: selectedReaction,
    isGoldenBid: goldenBidActive,
  });

  // Check for mutual interest
  const mutual = await db
    .select()
    .from(interestsTable)
    .where(and(eq(interestsTable.fromUser, toUserId), eq(interestsTable.toUser, userId)))
    .limit(1);

  if (mutual.length === 0) {
    res.json({
      recorded: true,
      matchCreated: false,
      matchId: null,
      reactionType: selectedReaction,
      isGoldenBid: goldenBidActive,
    });
    return;
  }

  // Mutual match exists: check if match row already exists
  const existingMatch = await db
    .select()
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userA, userId), eq(matchesTable.userB, toUserId)),
        and(eq(matchesTable.userA, toUserId), eq(matchesTable.userB, userId)),
      )
    )
    .limit(1);

  if (existingMatch.length > 0) {
    res.json({
      recorded: true,
      matchCreated: false,
      matchId: existingMatch[0]!.id,
      reactionType: selectedReaction,
      isGoldenBid: goldenBidActive,
    });
    return;
  }

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const assignedFirstUser = Math.random() > 0.5 ? userId : toUserId;

  const [match] = await db
    .insert(matchesTable)
    .values({
      userA: userId,
      userB: toUserId,
      assignedFirstUser,
      expiresAt,
    })
    .returning();

  res.json({
    recorded: true,
    matchCreated: true,
    matchId: match!.id,
    reactionType: selectedReaction,
    isGoldenBid: goldenBidActive,
  });
});

export default router;
