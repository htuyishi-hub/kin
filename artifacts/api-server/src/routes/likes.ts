import { Router } from "express";
import { eq, and, or, notExists, inArray, asc } from "drizzle-orm";
import {
  db,
  profilesTable,
  profilePhotosTable,
  interestsTable,
  passesTable,
  matchesTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 18;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return isNaN(age) ? 18 : age;
}

// GET /likes/received — Admirers who swiped right on the current user
router.get("/likes/received", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  const [me] = await db
    .select({ unblurredLikesUntil: profilesTable.unblurredLikesUntil })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  const isUnblurred = Boolean(
    me?.unblurredLikesUntil && new Date(me.unblurredLikesUntil).getTime() > Date.now()
  );

  // Incoming interests where current user hasn't liked, passed, or matched yet
  const incoming = await db
    .select({
      fromUser: interestsTable.fromUser,
      reactionType: interestsTable.reactionType,
      isGoldenBid: interestsTable.isGoldenBid,
      createdAt: interestsTable.createdAt,
    })
    .from(interestsTable)
    .where(
      and(
        eq(interestsTable.toUser, userId),
        notExists(
          db
            .select()
            .from(interestsTable)
            .where(
              and(
                eq(interestsTable.fromUser, userId),
                eq(interestsTable.toUser, interestsTable.fromUser)
              )
            )
        ),
        notExists(
          db
            .select()
            .from(passesTable)
            .where(
              and(
                eq(passesTable.userId, userId),
                eq(passesTable.targetUserId, interestsTable.fromUser)
              )
            )
        ),
        notExists(
          db
            .select()
            .from(matchesTable)
            .where(
              or(
                and(eq(matchesTable.userA, userId), eq(matchesTable.userB, interestsTable.fromUser)),
                and(eq(matchesTable.userA, interestsTable.fromUser), eq(matchesTable.userB, userId))
              )
            )
        )
      )
    );

  // Note: drizzle self-alias in notExists above needs explicit check if same table
  const [myInterests, myPasses, myMatches] = await Promise.all([
    db.select({ toUser: interestsTable.toUser }).from(interestsTable).where(eq(interestsTable.fromUser, userId)),
    db.select({ targetUserId: passesTable.targetUserId }).from(passesTable).where(eq(passesTable.userId, userId)),
    db.select({ userA: matchesTable.userA, userB: matchesTable.userB }).from(matchesTable).where(or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId))),
  ]);

  const excludedIds = new Set<string>([
    ...myInterests.map((i) => i.toUser),
    ...myPasses.map((p) => p.targetUserId),
    ...myMatches.map((m) => (m.userA === userId ? m.userB : m.userA)),
  ]);

  const filteredIncoming = incoming.filter((i) => !excludedIds.has(i.fromUser));

  if (filteredIncoming.length === 0) {
    res.json({
      isUnblurred,
      unblurredUntil: me?.unblurredLikesUntil?.toISOString() ?? null,
      count: 0,
      admirers: [],
    });
    return;
  }

  const admirerIds = filteredIncoming.map((i) => i.fromUser);
  const [admirerProfiles, photos] = await Promise.all([
    db.select().from(profilesTable).where(inArray(profilesTable.id, admirerIds)),
    db
      .select({
        userId: profilePhotosTable.userId,
        publicUrl: profilePhotosTable.publicUrl,
        storagePath: profilePhotosTable.storagePath,
        sortOrder: profilePhotosTable.sortOrder,
      })
      .from(profilePhotosTable)
      .where(inArray(profilePhotosTable.userId, admirerIds))
      .orderBy(asc(profilePhotosTable.sortOrder)),
  ]);

  const photoMap = new Map<string, string>();
  for (const p of photos) {
    if (!photoMap.has(p.userId)) {
      const url = p.publicUrl || p.storagePath;
      if (url) photoMap.set(p.userId, url);
    }
  }

  const profileMap = new Map(admirerProfiles.map((p) => [p.id, p]));

  const admirers = filteredIncoming
    .map((inc) => {
      const p = profileMap.get(inc.fromUser);
      if (!p) return null;
      const firstName = p.fullName?.trim().split(" ")[0] ?? null;
      return {
        id: p.id,
        displayName: isUnblurred ? firstName : null,
        age: p.dateOfBirth ? calculateAge(p.dateOfBirth) : null,
        photoUrl: photoMap.get(p.id) ?? null,
        primaryIntent: p.intentClass ?? p.primaryIntent ?? "Serious",
        occupation: isUnblurred ? p.faculty ?? null : null,
        campus: p.campusName ?? p.campus ?? p.city ?? "Kigali",
        isVerified: Boolean(p.isVerified || p.institutionVerified),
        isGoldenBid: Boolean(inc.isGoldenBid),
      };
    })
    .filter(Boolean);

  res.json({
    isUnblurred,
    unblurredUntil: me?.unblurredLikesUntil?.toISOString() ?? null,
    count: admirers.length,
    admirers,
  });
});

// POST /likes/unblur — Unblur Secret Admirers for 24 hours (500 RWF via MoMo 623507)
router.post("/likes/unblur", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  await db.insert(paymentsTable).values({
    userId,
    productType: "unblur_likes",
    amountRwf: 500,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  const unblurredUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db
    .update(profilesTable)
    .set({ unblurredLikesUntil: unblurredUntil })
    .where(eq(profilesTable.id, userId));

  res.json({
    success: true,
    unblurredUntil: unblurredUntil.toISOString(),
    amountRwf: 500,
    momoCode: "623507",
  });
});

// POST /likes/instant-match — Match immediately with an admirer
router.post("/likes/instant-match", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { admirerId } = req.body as { admirerId?: string };

  if (!admirerId || admirerId === userId) {
    res.status(400).json({ error: "bad_request", message: "Valid admirerId is required" });
    return;
  }

  await db
    .insert(interestsTable)
    .values({
      fromUser: userId,
      toUser: admirerId,
      reactionType: "serious",
      isGoldenBid: false,
    })
    .onConflictDoNothing();

  const existingMatch = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.userA, userId), eq(matchesTable.userB, admirerId)),
        and(eq(matchesTable.userA, admirerId), eq(matchesTable.userB, userId))
      )
    )
    .limit(1);

  if (existingMatch[0]) {
    res.json({ success: true, matchId: existingMatch[0].id });
    return;
  }

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const [created] = await db
    .insert(matchesTable)
    .values({
      userA: userId,
      userB: admirerId,
      assignedFirstUser: userId,
      expiresAt,
      status: "active",
    })
    .returning();

  res.json({ success: true, matchId: created!.id });
});

export default router;
