import { Router } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import {
  db,
  profilesTable,
  secretCrushesTable,
  matchesTable,
  messagesTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { normalizeRwandaPhone } from "./contacts.js";

const router = Router();

// GET /crush — List user's secret crush slots
router.get("/crush", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select({
      id: secretCrushesTable.id,
      targetPhone: secretCrushesTable.targetPhone,
      targetUserId: secretCrushesTable.targetUserId,
      isMatched: secretCrushesTable.isMatched,
      createdAt: secretCrushesTable.createdAt,
    })
    .from(secretCrushesTable)
    .where(eq(secretCrushesTable.userId, userId))
    .orderBy(desc(secretCrushesTable.createdAt));

  res.json({
    crushes: rows,
    slotsUsed: rows.length,
    maxFreeSlots: 3,
  });
});

// POST /crush/add — Add a confidential secret crush & check for mutual match
router.post("/crush/add", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { targetPhone } = req.body as { targetPhone?: string };
  const normalized = normalizeRwandaPhone(String(targetPhone || ""));

  if (normalized.length < 9) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }

  const existing = await db
    .select()
    .from(secretCrushesTable)
    .where(eq(secretCrushesTable.userId, userId));

  if (existing.some((c) => c.targetPhone === normalized)) {
    res.json({ matched: false, alreadyAdded: true });
    return;
  }

  if (existing.length >= 3) {
    res.status(402).json({ error: "SLOTS_FULL", message: "Unlock more crush slots" });
    return;
  }

  const [me] = await db
    .select({ phoneNumber: profilesTable.phoneNumber, fullName: profilesTable.fullName })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  const myNormPhone = me?.phoneNumber ? normalizeRwandaPhone(me.phoneNumber) : "";

  // Find if target phone belongs to a Kinn profile
  const allTargets = await db
    .select({
      id: profilesTable.id,
      phoneNumber: profilesTable.phoneNumber,
      fullName: profilesTable.fullName,
    })
    .from(profilesTable);

  const targetProfile = allTargets.find(
    (p) => p.id !== userId && p.phoneNumber && normalizeRwandaPhone(p.phoneNumber) === normalized
  );

  const [inserted] = await db
    .insert(secretCrushesTable)
    .values({
      userId,
      targetPhone: normalized,
      targetUserId: targetProfile?.id ?? null,
      isMatched: false,
    })
    .returning();

  // Check if target already added current user's phone as a secret crush
  let mutualCrush = null;
  if (targetProfile && myNormPhone) {
    const [reverse] = await db
      .select()
      .from(secretCrushesTable)
      .where(
        and(
          eq(secretCrushesTable.userId, targetProfile.id),
          eq(secretCrushesTable.targetPhone, myNormPhone)
        )
      )
      .limit(1);
    if (reverse) {
      mutualCrush = reverse;
    }
  }

  if (mutualCrush && targetProfile) {
    await db
      .update(secretCrushesTable)
      .set({ isMatched: true, targetUserId: targetProfile.id })
      .where(eq(secretCrushesTable.id, inserted!.id));

    await db
      .update(secretCrushesTable)
      .set({ isMatched: true, targetUserId: userId })
      .where(eq(secretCrushesTable.id, mutualCrush.id));

    const [a, b] = userId < targetProfile.id ? [userId, targetProfile.id] : [targetProfile.id, userId];
    const [existingMatch] = await db
      .select({ id: matchesTable.id })
      .from(matchesTable)
      .where(and(eq(matchesTable.userA, a), eq(matchesTable.userB, b)))
      .limit(1);

    let matchId = existingMatch?.id;
    if (!matchId) {
      const [createdMatch] = await db
        .insert(matchesTable)
        .values({
          userA: a,
          userB: b,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        })
        .returning({ id: matchesTable.id });
      matchId = createdMatch?.id;
      if (matchId) {
        await db.insert(messagesTable).values({
          matchId,
          senderId: userId,
          content: "It's a Mutual Secret Crush Match! 🎉 Both of you secretly picked each other on Kinn.",
        });
      }
    }

    res.json({
      matched: true,
      matchId,
      partnerProfile: {
        id: targetProfile.id,
        firstName: targetProfile.fullName?.trim().split(" ")[0] ?? "kinn Member",
      },
    });
    return;
  }

  res.json({
    matched: false,
    crush: inserted,
    inviteText: "Someone in your university circle secretly added you on Kinn! See if it's mutual: https://kinn.ink",
  });
});

// POST /crush/unlock — 200 RWF unlock extra crush slots
router.post("/crush/unlock", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  await db.insert(paymentsTable).values({
    userId,
    productType: "secret_crush_slots",
    amountRwf: 200,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });
  res.json({ success: true });
});

export default router;
