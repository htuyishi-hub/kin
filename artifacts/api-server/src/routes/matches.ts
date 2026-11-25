import { Router } from "express";
import { eq, and, or, inArray } from "drizzle-orm";
import { db, matchesTable, profilesTable, messagesTable, profilePhotosTable, exitSurveysTable, paymentsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function buildMilieuCards(me: typeof profilesTable.$inferSelect, other: typeof profilesTable.$inferSelect): string[] {
  const cards: string[] = [];
  if (me.campusName && me.campusName === other.campusName) {
    cards.push(`You both study at ${me.campusName}.`);
  }
  if (me.faculty && me.faculty === other.faculty) {
    cards.push(`You are both in the Faculty of ${me.faculty}.`);
  }
  if (me.hostelName && me.hostelName === other.hostelName) {
    cards.push(`You both live in ${me.hostelName}.`);
  }
  if (me.yearOfStudy && me.yearOfStudy === other.yearOfStudy) {
    cards.push(`You are both in Year ${me.yearOfStudy}.`);
  }
  return cards;
}

function mapMatch(
  match: typeof matchesTable.$inferSelect,
  userId: string,
  otherUser: typeof profilesTable.$inferSelect,
  primaryPhotoPath: string | null,
  unreadCount: number,
) {
  const isA = match.userA === userId;
  const myPhaseComplete = match.conversationPhase === 1
    ? (isA ? match.phase1CompleteA : match.phase1CompleteB)
    : match.conversationPhase === 2
    ? (isA ? match.phase2CompleteA : match.phase2CompleteB)
    : true;

  return {
    id: match.id,
    otherUserId: otherUser.id,
    otherUserName: otherUser.fullName ?? "Unknown",
    otherUserAge: otherUser.dateOfBirth ? calculateAge(otherUser.dateOfBirth) : null,
    otherUserPrimaryPhoto: primaryPhotoPath,
    otherUserLastActive: otherUser.lastActive?.toISOString() ?? null,
    status: match.status,
    conversationPhase: match.conversationPhase ?? 1,
    assignedFirstUserId: match.assignedFirstUser ?? null,
    firstMessageSent: match.firstMessageSent ?? false,
    expiresAt: match.expiresAt?.toISOString() ?? new Date().toISOString(),
    lastMessageAt: match.lastMessageAt?.toISOString() ?? null,
    createdAt: match.createdAt?.toISOString() ?? new Date().toISOString(),
    streakCount: match.streakCount ?? 0,
    lastStreakDate: match.lastStreakDate ?? null,
    isRevived: match.isRevived ?? false,
    myPhaseComplete: myPhaseComplete ?? false,
    unreadCount,
  };
}

// GET /matches
router.get("/matches", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  const matches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId)),
        eq(matchesTable.status, "active"),
      )
    );

  if (matches.length === 0) {
    res.json([]);
    return;
  }

  const otherIds = matches.map((m) => (m.userA === userId ? m.userB : m.userA));
  const others = await db
    .select()
    .from(profilesTable)
    .where(inArray(profilesTable.id, otherIds));

  const photos = await db
    .select()
    .from(profilePhotosTable)
    .where(and(inArray(profilePhotosTable.userId, otherIds), eq(profilePhotosTable.isPrimary, true)));

  const otherMap = new Map(others.map((o) => [o.id, o]));
  const photoMap = new Map(photos.map((p) => [p.userId, p.storagePath]));

  const result = matches.map((m) => {
    const otherId = m.userA === userId ? m.userB : m.userA;
    const other = otherMap.get(otherId);
    if (!other) return null;
    return mapMatch(m, userId, other, photoMap.get(otherId) ?? null, 0);
  }).filter(Boolean);

  res.json(result);
});

// GET /matches/:matchId
router.get("/matches/:matchId", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.id, String(matchId)),
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId)),
      )
    )
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found" });
    return;
  }

  const otherId = match.userA === userId ? match.userB : match.userA;
  const me = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  const other = await db.select().from(profilesTable).where(eq(profilesTable.id, otherId)).limit(1);

  if (!other[0] || !me[0]) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }

  const photo = await db
    .select()
    .from(profilePhotosTable)
    .where(and(eq(profilePhotosTable.userId, otherId), eq(profilePhotosTable.isPrimary, true)))
    .limit(1);

  const milieuCards = buildMilieuCards(me[0], other[0]);

  const introductionCard = `${other[0].fullName}, meet someone who shares your values.\nLike you, ${other[0].fullName?.split(" ")[0]} has been vouched for by people in their community and is looking for ${match.conversationPhase === 1 ? "a meaningful connection" : "the same things you are"}. ${milieuCards.length > 0 ? milieuCards[0] : "You both value honesty and community trust."}\n\nWe think you two should talk.`;

  const baseMatch = mapMatch(match, userId, other[0], photo[0]?.storagePath ?? null, 0);

  res.json({
    ...baseMatch,
    otherUser: {
      id: other[0].id,
      fullName: other[0].fullName ?? "Unknown",
      gender: other[0].gender ?? null,
      age: other[0].dateOfBirth ? calculateAge(other[0].dateOfBirth) : null,
      campusName: other[0].campusName ?? null,
      faculty: other[0].faculty ?? null,
      yearOfStudy: other[0].yearOfStudy ?? null,
      hostelName: other[0].hostelName ?? null,
      city: other[0].city ?? null,
      primaryIntent: other[0].primaryIntent ?? null,
      vouchCount: other[0].vouchCount ?? 0,
      primaryPhotoPath: photo[0]?.storagePath ?? null,
      bio: other[0].bio ?? null,
      tags: (other[0].tags as string[]) ?? [],
      voiceIntroPath: other[0].voiceIntroPath ?? null,
      voiceIntroDurationMs: other[0].voiceIntroDurationMs ?? null,
      milieuScore: 0,
      vouchOverlap: 0,
      milieuCards,
    },
    introductionCard,
    milieuCards,
  });
});

// POST /matches/:matchId/exit
router.post("/matches/:matchId/exit", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;

  await db
    .update(matchesTable)
    .set({ status: "exited", exitedAt: new Date() })
    .where(
      and(
        eq(matchesTable.id, String(matchId)),
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId)),
      )
    );

  res.json({ message: "Match exited. Go build something beautiful together." });
});

// POST /matches/:matchId/survey
router.post("/matches/:matchId/survey", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;
  const { metInPerson, wasRespectful } = req.body as {
    metInPerson?: boolean;
    wasRespectful?: boolean;
  };

  await db
    .insert(exitSurveysTable)
    .values({
      matchId: String(matchId),
      respondentId: userId,
      metInPerson: metInPerson ?? null,
      wasRespectful: wasRespectful ?? null,
    })
    .onConflictDoNothing();

  res.json({ message: "Survey submitted. Thank you." });
});

// POST /matches/:matchId/revive — 72-Hour Match Revive (300 RWF via MoMo)
router.post("/matches/:matchId/revive", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { matchId } = req.params;

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.id, String(matchId)),
        or(eq(matchesTable.userA, userId), eq(matchesTable.userB, userId))
      )
    )
    .limit(1);

  if (!match) {
    res.status(404).json({ error: "not_found", message: "Match not found" });
    return;
  }

  await db.insert(paymentsTable).values({
    userId,
    productType: "match_revive",
    amountRwf: 200,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const [updated] = await db
    .update(matchesTable)
    .set({
      expiresAt: newExpiresAt,
      isRevived: true,
      status: "active",
    })
    .where(eq(matchesTable.id, String(matchId)))
    .returning();

  res.json({
    revived: true,
    matchId: updated!.id,
    expiresAt: newExpiresAt.toISOString(),
    isRevived: true,
    amountRwf: 200,
  });
});

// POST /matches/:matchId/nudge — Send gentle nudge for dormant match
router.post("/matches/:matchId/nudge", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const matchId = String(req.params["matchId"] ?? "");

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);

  if (!match || (match.userA !== userId && match.userB !== userId)) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.json({ nudged: true, matchId });
});

export default router;
