import { Router } from "express";
import { eq, ne, and, sql, inArray, notExists, or, asc } from "drizzle-orm";
import {
  db,
  profilesTable,
  profilePhotosTable,
  interestsTable,
  matchesTable,
  reportsTable,
  vouchesTable,
  passesTable,
} from "@workspace/db";
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

// GET /match-queue — Intent-Gated Teaser Swipe Deck & Golden Bid Sorting
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
    res.json({
      status: "onboarding_incomplete",
      matches: [],
    });
    return;
  }

  const isVerifiedUser =
    Boolean(myProfile.institutionVerified) ||
    Boolean(myProfile.isVerified) ||
    Boolean(myProfile.invitedByProfile) ||
    (myProfile.vouchCount ?? 0) >= 1;

  if (!isVerifiedUser) {
    res.status(403).json({
      error: "not_ready",
      message: "You must be approved by an existing Kin member or verified with your University of Rwanda registration number to join the match pool.",
    });
    return;
  }

  // 1. Intent Gating: strictly match identical intent_class / primary_intent
  const myIntent = myProfile.intentClass ?? myProfile.primaryIntent ?? "Serious";

  // 2. Build eligible candidate pool excluding:
  //    - already liked by me
  //    - mutual matches
  //    - soft-passed within 14 days
  //    - hard-rejected
  //    - reported users
  const candidates = await db
    .select()
    .from(profilesTable)
    .where(
      and(
        ne(profilesTable.id, userId),
        eq(profilesTable.profileActive, true),
        eq(profilesTable.onboardingComplete, true),
        // Intent Gating: STRICTLY same intent class
        eq(sql`COALESCE(${profilesTable.intentClass}, ${profilesTable.primaryIntent})`, myIntent),
        // Exclude profiles I already liked
        notExists(
          db
            .select()
            .from(interestsTable)
            .where(and(eq(interestsTable.fromUser, userId), eq(interestsTable.toUser, profilesTable.id)))
        ),
        // Exclude active matches
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
        // Exclude soft-passed (within 14 days) or hard-rejected
        notExists(
          db
            .select()
            .from(passesTable)
            .where(
              and(
                eq(passesTable.userId, userId),
                eq(passesTable.targetUserId, profilesTable.id),
                or(
                  eq(passesTable.type, "hard_reject"),
                  and(
                    eq(passesTable.type, "soft_pass"),
                    or(sql`${passesTable.expiresAt} IS NULL`, sql`${passesTable.expiresAt} > now()`)
                  )
                )
              )
            )
        ),
        // Exclude if candidate hard-rejected me
        notExists(
          db
            .select()
            .from(passesTable)
            .where(
              and(
                eq(passesTable.userId, profilesTable.id),
                eq(passesTable.targetUserId, userId),
                eq(passesTable.type, "hard_reject")
              )
            )
        ),
        // Exclude reported users
        notExists(
          db
            .select()
            .from(reportsTable)
            .where(and(eq(reportsTable.reportedId, profilesTable.id), eq(reportsTable.status, "confirmed")))
        )
      )
    )
    .limit(limit * 3);

  if (candidates.length === 0) {
    res.json([]);
    return;
  }

  const candidateIds = candidates.map((c) => c.id);

  // 3. Fetch incoming interests from candidates to current user (to detect Golden Bids & Reactions)
  const incomingInterests = await db
    .select({
      fromUser: interestsTable.fromUser,
      reactionType: interestsTable.reactionType,
      isGoldenBid: interestsTable.isGoldenBid,
    })
    .from(interestsTable)
    .where(and(eq(interestsTable.toUser, userId), inArray(interestsTable.fromUser, candidateIds)));

  const incomingMap = new Map(incomingInterests.map((item) => [item.fromUser, item]));

  // 4. Fetch photos strictly limited to 2 photos per user
  const photos = await db
    .select({
      userId: profilePhotosTable.userId,
      publicUrl: profilePhotosTable.publicUrl,
      sortOrder: profilePhotosTable.sortOrder,
    })
    .from(profilePhotosTable)
    .where(inArray(profilePhotosTable.userId, candidateIds))
    .orderBy(asc(profilePhotosTable.sortOrder));

  const photoMap = new Map<string, string[]>();
  for (const p of photos) {
    if (!photoMap.has(p.userId)) photoMap.set(p.userId, []);
    const list = photoMap.get(p.userId)!;
    if (list.length < 2 && p.publicUrl) {
      list.push(p.publicUrl);
    }
  }

  // 5. Fetch confirmed approvals / vouchers for candidate profiles
  const vouchRows = await db
    .select({
      voucheeId: vouchesTable.vouchedUser,
      voucherName: profilesTable.fullName,
      voucherIsVerified: profilesTable.isVerified,
      voucherInstitutionVerified: profilesTable.institutionVerified,
    })
    .from(vouchesTable)
    .innerJoin(profilesTable, eq(vouchesTable.voucher, profilesTable.id))
    .where(and(inArray(vouchesTable.vouchedUser, candidateIds), eq(vouchesTable.status, "confirmed")));

  const approvedByMap = new Map<string, { fullName: string; firstName: string; isVerified: boolean }>();
  for (const v of vouchRows) {
    if (!approvedByMap.has(v.voucheeId)) {
      const fn = v.voucherName?.trim().split(" ")[0] ?? "Member";
      approvedByMap.set(v.voucheeId, {
        fullName: v.voucherName ?? "Community Member",
        firstName: fn,
        isVerified: Boolean(v.voucherIsVerified || v.voucherInstitutionVerified),
      });
    }
  }

  // 6. Rank candidates with GOLDEN BID PRIORITY (+100000 boost to top of stack)
  const ranked = candidates
    .map((c) => {
      const incoming = incomingMap.get(c.id);
      const isGoldenBid = Boolean(incoming?.isGoldenBid);

      let rank = 0;
      // Golden Bids ALWAYS sort to the absolute top of the stack
      if (isGoldenBid) {
        rank += 100000;
      }

      const trustScore = c.trustScore ?? 1;
      const activityBoost = c.lastActive && c.lastActive > new Date(Date.now() - 7 * 24 * 3600 * 1000) ? 20 : 0;
      rank += trustScore * 0.5 + activityBoost;

      return { c, isGoldenBid, incomingReaction: incoming?.reactionType ?? null, rank };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);

  // 7. Format Teaser Swipe Deck payload:
  //    STRICT maximum of 2 photos, and ONLY the user's First Name.
  const result = ranked.map(({ c, isGoldenBid, incomingReaction }) => {
    const rawName = c.fullName?.trim() ?? "Kin Member";
    const firstName = rawName.split(" ")[0] ?? "Member";
    const candidatePhotos = photoMap.get(c.id) ?? [];

    return {
      id: c.id,
      firstName,
      photos: candidatePhotos, // STRICT maximum of 2 photos
      primaryPhotoPath: candidatePhotos[0] ?? null,
      is_golden_bid: isGoldenBid,
      incoming_reaction: incomingReaction,
      intent_class: myIntent,
      trustScore: c.trustScore ?? 1,
      // Terminology updated to 'approvedBy' (with backward compatible 'vouchedBy')
      approvedBy: approvedByMap.get(c.id) ?? null,
      vouchedBy: approvedByMap.get(c.id) ?? null,
    };
  });

  res.json(result);
});

export default router;
