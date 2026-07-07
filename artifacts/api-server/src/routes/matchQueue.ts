import { Router } from "express";
import { eq, ne, and, sql, inArray, notExists, or } from "drizzle-orm";
import { db, profilesTable, profilePhotosTable, microPromptsTable, promptDefinitionsTable, interestsTable, matchesTable, reportsTable, vouchesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

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

// GET /match-queue
router.get("/match-queue", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const limit = Math.min(Number(req.query["limit"] ?? 20), 50);

  const me = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  if (!me[0]) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  const myProfile = me[0];

  if (!myProfile.onboardingComplete) {
    res.status(403).json({ error: "forbidden", message: "Complete onboarding first" });
    return;
  }

  // UR privilege: institution_verified students can join match pool with fewer vouches.
  // Verified by UR registry means they get a privilege similar to having vouches.
  const hasURPrivilege = Boolean(myProfile.institutionVerified);

  if (!hasURPrivilege && (myProfile.vouchCount ?? 0) < 2) {
    res.status(403).json({ error: "not_ready", message: "You need at least 2 confirmed vouches to join the match pool" });
    return;
  }


  // Build eligible candidate pool
  const candidates = await db
    .select()
    .from(profilesTable)
    .where(
      and(
        ne(profilesTable.id, userId),
        eq(profilesTable.profileActive, true),
        eq(profilesTable.onboardingComplete, true),
        sql`${profilesTable.trustScore} >= 20`,
        eq(profilesTable.primaryIntent, myProfile.primaryIntent ?? "Serious"),
        // Tier wall — only same tier unless crossing fee paid + Marriage intent
        myProfile.crossingFeePaid && myProfile.primaryIntent === "Marriage"
          ? or(
              eq(profilesTable.hiddenTier, myProfile.hiddenTier ?? 1),
              and(eq(profilesTable.hiddenTier, 2), eq(profilesTable.primaryIntent, "Marriage")),
            )
          : eq(profilesTable.hiddenTier, myProfile.hiddenTier ?? 1),
        // Exclude already-interacted
        notExists(
          db.select().from(interestsTable).where(
            or(
              and(eq(interestsTable.fromUser, userId), eq(interestsTable.toUser, profilesTable.id)),
              and(eq(interestsTable.fromUser, profilesTable.id), eq(interestsTable.toUser, userId)),
            )
          )
        ),
        // Exclude confirmed-reported users
        notExists(
          db.select().from(reportsTable).where(
            and(eq(reportsTable.reportedId, profilesTable.id), eq(reportsTable.status, "confirmed"))
          )
        ),
      )
    )
    .limit(limit * 3); // Fetch more to rank

  if (candidates.length === 0) {
    res.json([]);
    return;
  }

  const candidateIds = candidates.map((c) => c.id);

  // Fetch primary photos
  const photos = await db
    .select()
    .from(profilePhotosTable)
    .where(
      and(
        inArray(profilePhotosTable.userId, candidateIds),
        eq(profilePhotosTable.isPrimary, true),
      )
    );

  const photoMap = new Map(photos.map((p) => [p.userId, p.storagePath]));

  // Fetch micro-prompts for each candidate
  const prompts = await db
    .select({
      userId: microPromptsTable.userId,
      id: microPromptsTable.id,
      promptKey: microPromptsTable.promptKey,
      answer: microPromptsTable.answer,
      sortOrder: microPromptsTable.sortOrder,
      promptText: promptDefinitionsTable.promptText,
      promptRw: promptDefinitionsTable.promptRw,
    })
    .from(microPromptsTable)
    .innerJoin(promptDefinitionsTable, eq(microPromptsTable.promptKey, promptDefinitionsTable.key))
    .where(inArray(microPromptsTable.userId, candidateIds));

  const promptMap = new Map<string, typeof prompts>();
  for (const p of prompts) {
    if (!promptMap.has(p.userId)) promptMap.set(p.userId, []);
    promptMap.get(p.userId)!.push(p);
  }

  // Compute milieu scores and rank
  const ranked = candidates
    .map((c) => {
      let milieuScore = 0;
      if (myProfile.campusName && c.campusName === myProfile.campusName) milieuScore += 30;
      if (myProfile.faculty && c.faculty === myProfile.faculty) milieuScore += 20;
      if (myProfile.hostelName && c.hostelName === myProfile.hostelName) milieuScore += 15;
      if (myProfile.yearOfStudy && c.yearOfStudy === myProfile.yearOfStudy) milieuScore += 10;

      const trustScore = c.trustScore ?? 50;
      const activityBoost = c.lastActive && c.lastActive > new Date(Date.now() - 7 * 24 * 3600 * 1000) ? 10 : 0;
      const rank = trustScore * 0.35 + milieuScore * 0.30 + activityBoost * 0.15;

      return { c, milieuScore, rank };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);

  const result = ranked.map(({ c, milieuScore }) => ({
    id: c.id,
    fullName: c.fullName ?? "Unknown",
    gender: c.gender ?? null,
    age: c.dateOfBirth ? calculateAge(c.dateOfBirth) : null,
    campusName: c.campusName ?? null,
    faculty: c.faculty ?? null,
    yearOfStudy: c.yearOfStudy ?? null,
    hostelName: c.hostelName ?? null,
    city: c.city ?? null,
    primaryIntent: c.primaryIntent ?? null,
    vouchCount: c.vouchCount ?? 0,
    primaryPhotoPath: photoMap.get(c.id) ?? null,
    milieuScore,
    vouchOverlap: 0,
    microPrompts: (promptMap.get(c.id) ?? []).map((p) => ({
      id: p.id,
      promptKey: p.promptKey,
      promptText: p.promptText,
      promptRw: p.promptRw,
      answer: p.answer,
      sortOrder: p.sortOrder ?? 0,
    })),
    milieuCards: buildMilieuCards(myProfile, c),
  }));

  res.json(result);
});

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export default router;
