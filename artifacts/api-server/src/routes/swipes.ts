import { Router } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db, interestsTable, matchesTable, passesTable, profilesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { generateInviteCode } from "../lib/inviteCode.js";
import { getSwipeStatus, getTodayDateStr, WHATSAPP_BONUS_SWIPES } from "../lib/swipes.js";

const router = Router();

// GET /swipes/status
router.get("/swipes/status", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const status = await getSwipeStatus(userId);
  res.json(status);
});

// POST /swipes/rewind — Undo last pass or unmatched interest
router.post("/swipes/rewind", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { targetUserId } = req.body as { targetUserId?: string };

  if (!targetUserId) {
    res.status(400).json({ error: "bad_request", message: "targetUserId is required" });
    return;
  }

  // Delete any pass on targetUserId
  const deletedPass = await db
    .delete(passesTable)
    .where(and(eq(passesTable.userId, userId), eq(passesTable.targetUserId, targetUserId)))
    .returning({ id: passesTable.id });

  // Delete interest if not already matched
  let deletedInterestCount = 0;
  const existingMatch = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userA, userId), eq(matchesTable.userB, targetUserId)),
        and(eq(matchesTable.userA, targetUserId), eq(matchesTable.userB, userId))
      )
    )
    .limit(1);

  if (existingMatch.length === 0) {
    const deletedInterest = await db
      .delete(interestsTable)
      .where(and(eq(interestsTable.fromUser, userId), eq(interestsTable.toUser, targetUserId)))
      .returning({ id: interestsTable.id });
    deletedInterestCount = deletedInterest.length;
  }

  const status = await getSwipeStatus(userId);
  res.json({
    rewound: deletedPass.length > 0 || deletedInterestCount > 0,
    targetUserId,
    ...status,
  });
});

// POST /swipes/whatsapp-bonus — Grant +30 swipes for WhatsApp invite share
router.post("/swipes/whatsapp-bonus", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const today = getTodayDateStr();

  const [profile] = await db
    .select({
      id: profilesTable.id,
      inviteCode: profilesTable.inviteCode,
      bonusSwipesToday: profilesTable.bonusSwipesToday,
      bonusSwipesDate: profilesTable.bonusSwipesDate,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  const currentBonus = profile.bonusSwipesDate === today ? (profile.bonusSwipesToday ?? 0) : 0;
  const nextBonus = currentBonus + WHATSAPP_BONUS_SWIPES;
  const inviteCode = profile.inviteCode ?? generateInviteCode();

  await db
    .update(profilesTable)
    .set({
      bonusSwipesToday: nextBonus,
      bonusSwipesDate: today,
      inviteCode,
    })
    .where(eq(profilesTable.id, userId));

  const status = await getSwipeStatus(userId);
  res.json(status);
});

export default router;
