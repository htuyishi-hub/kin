import { Router } from "express";
import { and, asc, desc, eq, gt, gte, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  profilePhotosTable,
  popularityVotesTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// GET /leaderboard — Most Wanted Trending Leaderboard
router.get("/leaderboard", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const zone = String(req.query["zone"] ?? "All");
  const now = new Date();

  const conditions = [
    eq(profilesTable.profileActive, true),
    eq(profilesTable.onboardingComplete, true),
    eq(profilesTable.isIncognito, false),
  ];

  if (zone && zone !== "All") {
    conditions.push(eq(profilesTable.campusZone, zone));
  }

  const allProfiles = await db
    .select({
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      campusName: profilesTable.campusName,
      campusZone: profilesTable.campusZone,
      city: profilesTable.city,
      popularityScore: profilesTable.popularityScore,
      spotlightUntil: profilesTable.spotlightUntil,
      isVerified: profilesTable.isVerified,
      verificationStatus: profilesTable.verificationStatus,
    })
    .from(profilesTable)
    .where(and(...conditions))
    .orderBy(desc(profilesTable.popularityScore), desc(profilesTable.approvalScore))
    .limit(50);

  const ids = allProfiles.map((p) => p.id);
  const photos = ids.length
    ? await db
        .select({
          userId: profilePhotosTable.userId,
          publicUrl: profilePhotosTable.publicUrl,
          storagePath: profilePhotosTable.storagePath,
        })
        .from(profilePhotosTable)
        .where(eq(profilePhotosTable.isPrimary, true))
        .orderBy(asc(profilePhotosTable.sortOrder))
    : [];

  const photoMap = new Map<string, string>();
  for (const ph of photos) {
    if (!photoMap.has(ph.userId)) {
      const url = ph.publicUrl || ph.storagePath;
      if (url) photoMap.set(ph.userId, url);
    }
  }

  const mapped = allProfiles.map((p, idx) => ({
    id: p.id,
    rank: idx + 1,
    firstName: p.fullName?.trim().split(" ")[0] ?? "kinn Member",
    zone: p.campusZone ?? p.campusName ?? p.city ?? "Kigali",
    popularityScore: p.popularityScore ?? 0,
    isSpotlight: Boolean(p.spotlightUntil && p.spotlightUntil > now),
    isVerified: Boolean(p.isVerified || p.verificationStatus === "verified"),
    photoUrl: photoMap.get(p.id) ?? null,
  }));

  const spotlight = mapped.filter((p) => p.isSpotlight);
  const topPodium = mapped.slice(0, 3);
  const rankings = mapped.slice(3, 25);
  const meIndex = mapped.findIndex((p) => p.id === userId);
  const currentUser =
    meIndex >= 0
      ? mapped[meIndex]
      : {
          id: userId,
          rank: null,
          firstName: "You",
          zone: "Kigali",
          popularityScore: 0,
          isSpotlight: false,
          isVerified: false,
          photoUrl: photoMap.get(userId) ?? null,
        };

  res.json({
    spotlight,
    topPodium,
    rankings,
    currentUser,
  });
});

// POST /leaderboard/vote — Free Daily (+1 pt) or 100 RWF Rose (+5 pts)
router.post("/leaderboard/vote", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { targetUserId, voteType } = req.body as {
    targetUserId?: string;
    voteType?: "free" | "rose";
  };

  if (!targetUserId) {
    res.status(400).json({ error: "missing_target", message: "targetUserId required" });
    return;
  }

  const type = voteType === "rose" ? "rose" : "free";
  const points = type === "rose" ? 5 : 1;

  if (type === "free") {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const existingToday = await db
      .select({ id: popularityVotesTable.id })
      .from(popularityVotesTable)
      .where(
        and(
          eq(popularityVotesTable.voterId, userId),
          eq(popularityVotesTable.points, 1),
          gte(popularityVotesTable.createdAt, startOfDay)
        )
      )
      .limit(1);

    if (existingToday.length > 0) {
      res.status(429).json({ error: "daily_vote_used", message: "Daily free vote already used" });
      return;
    }
  } else {
    await db.insert(paymentsTable).values({
      userId,
      productType: "leaderboard_rose",
      amountRwf: 100,
      status: "completed",
      fulfilled: true,
      completedAt: new Date(),
    });
  }

  await db.insert(popularityVotesTable).values({
    voterId: userId,
    targetId: targetUserId,
    points,
  });

  const [updated] = await db
    .update(profilesTable)
    .set({
      popularityScore: sql`${profilesTable.popularityScore} + ${points}`,
    })
    .where(eq(profilesTable.id, targetUserId))
    .returning({ popularityScore: profilesTable.popularityScore });

  res.json({
    success: true,
    newScore: updated?.popularityScore ?? points,
  });
});

// POST /leaderboard/spotlight — 300 RWF VIP Spotlight (2 hours)
router.post("/leaderboard/spotlight", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const spotlightUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await db.insert(paymentsTable).values({
    userId,
    productType: "leaderboard_spotlight",
    amountRwf: 300,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  await db
    .update(profilesTable)
    .set({ spotlightUntil })
    .where(eq(profilesTable.id, userId));

  res.json({
    success: true,
    spotlightUntil: spotlightUntil.toISOString(),
  });
});

export default router;
