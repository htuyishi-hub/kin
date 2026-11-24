import { Router } from "express";
import { eq, and, or, ne, sql, notExists, count, inArray, asc } from "drizzle-orm";
import {
  db,
  profilesTable,
  reportsTable,
  matchesTable,
  interestsTable,
  profilePhotosTable,
  peopleImpressionsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { getStorageAdmin } from "../lib/storage.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Flag check
function isPeopleEnabled(): boolean {
  return process.env.PEOPLE_ENABLED === "true";
}

// Verification and active status helper
function isMemberVerified(profile: {
  accountStatus?: string | null;
  profileActive?: boolean | null;
  profilePaused?: boolean | null;
  institutionVerified?: boolean | null;
  isVerified?: boolean | null;
  invitedByProfile?: string | null;
  vouchCount?: number | null;
}): boolean {
  if (profile.accountStatus !== "active") return false;
  if (profile.profileActive === false || profile.profilePaused === true) return false;
  return (
    Boolean(profile.institutionVerified) ||
    Boolean(profile.isVerified) ||
    Boolean(profile.invitedByProfile) ||
    (profile.vouchCount ?? 0) >= 1
  );
}

function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 18;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return isNaN(age) ? 18 : age;
}

// GET /people — Members-only discoverable people list
router.get("/people", requireAuth, async (req, res) => {
  if (!isPeopleEnabled()) {
    res.status(404).json({
      code: "FEATURE_DISABLED",
      error: "feature_disabled",
      message: "People feature is disabled",
    });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const [viewer] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);

  if (!viewer || !isMemberVerified(viewer)) {
    res.status(403).json({
      error: "forbidden",
      code: "VIEWER_NOT_ELIGIBLE",
      message: "Active verified status required",
    });
    return;
  }

  const PEOPLE_DAILY_LIMIT = Number(process.env.PEOPLE_DAILY_LIMIT ?? 30);
  const FEED_MAX_IMPRESSIONS = Number(process.env.FEED_MAX_IMPRESSIONS ?? 40);
  const viewerIntent = viewer.intentClass ?? viewer.primaryIntent ?? "Serious";
  const viewerTier = viewer.hiddenTier ?? 1;
  const viewerCrossing = viewer.crossingFeePaid ?? false;

  // 1. Viewer daily impression cap: max 30 distinct profiles per day
  const todayImpressions = await db
    .select({ count: count() })
    .from(peopleImpressionsTable)
    .where(
      and(
        eq(peopleImpressionsTable.viewerId, userId),
        sql`${peopleImpressionsTable.viewDate} = CURRENT_DATE`
      )
    );

  const totalViewedToday = todayImpressions[0]?.count ?? 0;
  if (totalViewedToday >= PEOPLE_DAILY_LIMIT) {
    res.json({
      people: [],
      nextOffset: null,
      hasMore: false,
      dailyLimitReached: true,
      totalViewedToday,
    });
    return;
  }

  const limitParam = Math.min(Math.max(Number(req.query["limit"] ?? 10), 1), 20);
  const remainingAllowance = PEOPLE_DAILY_LIMIT - totalViewedToday;
  const effectiveLimit = Math.min(limitParam, remainingAllowance);
  const offset = Math.max(Number(req.query["offset"] ?? 0), 0);

  // 2. Build visibility conditions:
  // - Candidate is not the viewer
  // - Candidate has not hidden themselves from People list
  // - Candidate active and verified
  // - Strictly identical intent
  // - Matchable under hidden tier & crossing rules
  // - Neither has reported or blocked the other
  // - No existing active match
  // - Candidate exposure cap: impressions < FEED_MAX_IMPRESSIONS OR viewer already viewed candidate today
  const conditions = [
    ne(profilesTable.id, userId),
    sql`(${profilesTable.hideFromPeople} IS FALSE OR ${profilesTable.hideFromPeople} IS NULL)`,

    // Candidate active and verified
    eq(profilesTable.accountStatus, "active"),
    eq(profilesTable.profileActive, true),
    sql`(${profilesTable.profilePaused} IS FALSE OR ${profilesTable.profilePaused} IS NULL)`,
    sql`(${profilesTable.isVerified} = TRUE OR ${profilesTable.institutionVerified} = TRUE OR ${profilesTable.invitedByProfile} IS NOT NULL OR COALESCE(${profilesTable.vouchCount}, 0) >= 1)`,

    // Intent Gating: STRICTLY identical intent
    eq(sql`COALESCE(${profilesTable.intentClass}, ${profilesTable.primaryIntent})`, viewerIntent),

    // Hidden Tier & Crossing Rules
    sql`(
      ${profilesTable.hiddenTier} = ${viewerTier}
      OR (
        (${viewerCrossing} = TRUE OR ${profilesTable.crossingFeePaid} = TRUE)
        AND ${viewerIntent} IN ('Marriage', 'Serious Marriage')
        AND ${profilesTable.hiddenTier} IN (1, 2)
        AND ${viewerTier} IN (1, 2)
      )
    )`,

    // Neither has reported or blocked the other
    notExists(
      db
        .select()
        .from(reportsTable)
        .where(
          or(
            and(eq(reportsTable.reporterId, userId), eq(reportsTable.reportedId, profilesTable.id)),
            and(eq(reportsTable.reporterId, profilesTable.id), eq(reportsTable.reportedId, userId))
          )
        )
    ),

    // No existing active match
    notExists(
      db
        .select()
        .from(matchesTable)
        .where(
          or(
            and(eq(matchesTable.userA, userId), eq(matchesTable.userB, profilesTable.id)),
            and(eq(matchesTable.userA, profilesTable.id), eq(matchesTable.userB, userId))
          )
        )
    ),

    // Candidate exposure cap
    sql`(
      (SELECT count(*)::int FROM people_impressions WHERE profile_id = ${profilesTable.id} AND view_date = CURRENT_DATE) < ${FEED_MAX_IMPRESSIONS}
      OR EXISTS (
        SELECT 1 FROM people_impressions
        WHERE profile_id = ${profilesTable.id} AND viewer_id = ${userId} AND view_date = CURRENT_DATE
      )
    )`,
  ];

  // 3. Deterministic daily pseudo-random ordering fixed per viewer per day
  // Completely orthogonal to scores, activity, looks, paid items, or signup date
  const candidateRows = await db
    .select({
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      dateOfBirth: profilesTable.dateOfBirth,
      campusName: profilesTable.campusName,
      faculty: profilesTable.faculty,
      city: profilesTable.city,
      district: profilesTable.district,
      bio: profilesTable.bio,
      tags: profilesTable.tags,
      isVerified: profilesTable.isVerified,
      institutionVerified: profilesTable.institutionVerified,
    })
    .from(profilesTable)
    .where(and(...conditions))
    .orderBy(sql`md5(${profilesTable.id}::text || ${userId}::text || CURRENT_DATE::text)`)
    .limit(effectiveLimit + 1)
    .offset(offset);

  const hasMore = candidateRows.length > effectiveLimit;
  const returnedCandidates = hasMore ? candidateRows.slice(0, effectiveLimit) : candidateRows;
  const candidateIds = returnedCandidates.map((c) => c.id);

  // 4. Batch query interest status (has viewer already approached/interested them)
  const interestedRows =
    candidateIds.length > 0
      ? await db
          .select({ toUser: interestsTable.toUser })
          .from(interestsTable)
          .where(and(eq(interestsTable.fromUser, userId), inArray(interestsTable.toUser, candidateIds)))
      : [];
  const interestedSet = new Set(interestedRows.map((r) => r.toUser));

  // 5. Batch query primary photos and generate secure signed URLs
  const photoRows =
    candidateIds.length > 0
      ? await db
          .select({
            userId: profilePhotosTable.userId,
            storagePath: profilePhotosTable.storagePath,
            publicUrl: profilePhotosTable.publicUrl,
          })
          .from(profilePhotosTable)
          .where(inArray(profilePhotosTable.userId, candidateIds))
          .orderBy(asc(profilePhotosTable.sortOrder))
      : [];

  const admin = getStorageAdmin();
  const photoMap = new Map<string, string>();
  for (const p of photoRows) {
    if (!photoMap.has(p.userId)) {
      if (admin && p.storagePath) {
        try {
          const { data } = await admin.storage.from("profile-photos").createSignedUrl(p.storagePath, 300);
          if (data?.signedUrl) {
            photoMap.set(p.userId, data.signedUrl);
            continue;
          }
        } catch {
          // ignore error and fallback
        }
      }
      if (p.publicUrl) {
        photoMap.set(p.userId, p.publicUrl);
      }
    }
  }

  // 6. Record impressions for returned profiles
  if (returnedCandidates.length > 0) {
    const impressionValues = returnedCandidates.map((c) => ({
      profileId: c.id,
      viewerId: userId,
      viewDate: sql`CURRENT_DATE`,
    }));

    try {
      await db
        .insert(peopleImpressionsTable)
        .values(impressionValues as any)
        .onConflictDoNothing();
    } catch (err) {
      logger.error({ err }, "[people] Failed to record people impressions");
    }
  }

  // 7. Strip private data: only first name, age, campus, faculty, city, tags, bio.
  // NEVER return hidden_tier, scores, full name, phone, email, or date of birth.
  const people = returnedCandidates.map((c) => {
    const rawName = c.fullName?.trim() ?? "kinn Member";
    const firstName = rawName.split(" ")[0] ?? "Member";
    const age = c.dateOfBirth ? calculateAge(c.dateOfBirth) : null;

    return {
      id: c.id,
      firstName,
      age,
      campusName: c.campusName ?? null,
      faculty: c.faculty ?? null,
      city: c.city ?? null,
      district: c.district ?? null,
      bio: c.bio ?? null,
      tags: (c.tags as string[]) ?? [],
      photoUrl: photoMap.get(c.id) ?? null,
      isVerified: Boolean(c.isVerified || c.institutionVerified),
      hasInterested: interestedSet.has(c.id),
    };
  });

  const newTotal = totalViewedToday + people.length;

  res.json({
    people,
    nextOffset: hasMore ? offset + people.length : null,
    hasMore,
    dailyLimitReached: newTotal >= PEOPLE_DAILY_LIMIT,
    totalViewedToday: newTotal,
  });
});

export default router;
