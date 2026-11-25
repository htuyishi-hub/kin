import { Router } from "express";
import { eq, ne, and, sql, inArray, notExists, exists, or, asc } from "drizzle-orm";
import {
  db,
  profilesTable,
  profilePhotosTable,
  interestsTable,
  matchesTable,
  reportsTable,
  vouchesTable,
  passesTable,
  blockedContactsTable,
  photoCommentsTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { normalizeRwandaPhone } from "./contacts.js";
import { haversineKm } from "../lib/geo.js";

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

  // Build eligible candidate pool excluding:
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
        or(
          eq(profilesTable.isIncognito, false),
          exists(
            db
              .select()
              .from(interestsTable)
              .where(and(eq(interestsTable.fromUser, profilesTable.id), eq(interestsTable.toUser, userId)))
          )
        ),
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

  // Filter out Hide Friends / Blocked Contacts (both directions)
  const myBlockedRows = await db
    .select({ blockedPhone: blockedContactsTable.blockedPhone })
    .from(blockedContactsTable)
    .where(eq(blockedContactsTable.userId, userId));
  const myBlockedPhones = new Set(myBlockedRows.map((r) => normalizeRwandaPhone(r.blockedPhone)));

  const myNormalizedPhone = myProfile.phoneNumber ? normalizeRwandaPhone(myProfile.phoneNumber) : "";
  const blockedMeRows = myNormalizedPhone
    ? await db
        .select({ userId: blockedContactsTable.userId })
        .from(blockedContactsTable)
        .where(eq(blockedContactsTable.blockedPhone, myNormalizedPhone))
    : [];
  const blockedMeIds = new Set(blockedMeRows.map((r) => r.userId));

  const visibleCandidates = candidates.filter((c) => {
    if (blockedMeIds.has(c.id)) return false;
    if (c.phoneNumber && myBlockedPhones.has(normalizeRwandaPhone(c.phoneNumber))) return false;
    return true;
  });

  if (visibleCandidates.length === 0) {
    res.json([]);
    return;
  }

  const candidateIds = visibleCandidates.map((c) => c.id);

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

  // 4. Fetch photos (up to 6 photos per user for story-style tapping)
  const photos = await db
    .select({
      userId: profilePhotosTable.userId,
      publicUrl: profilePhotosTable.publicUrl,
      storagePath: profilePhotosTable.storagePath,
      sortOrder: profilePhotosTable.sortOrder,
    })
    .from(profilePhotosTable)
    .where(inArray(profilePhotosTable.userId, candidateIds))
    .orderBy(asc(profilePhotosTable.sortOrder));

  const photoMap = new Map<string, string[]>();
  for (const p of photos) {
    if (!photoMap.has(p.userId)) photoMap.set(p.userId, []);
    const list = photoMap.get(p.userId)!;
    const url = p.publicUrl || p.storagePath;
    if (list.length < 6 && url) {
      list.push(url);
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
  const ranked = visibleCandidates
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

  // 7. Format Swipe Deck payload with rich profile metadata
  const result = ranked.map(({ c, isGoldenBid, incomingReaction }) => {
    const rawName = c.fullName?.trim() ?? "kinn Member";
    const firstName = rawName.split(" ")[0] ?? "Member";
    const candidatePhotos = photoMap.get(c.id) ?? [];
    const candidateIntent = c.intentClass ?? c.primaryIntent ?? "Serious";
    const isUrStudent = Boolean(c.institutionVerified);
    const isVerified = Boolean(
      c.institutionVerified ||
      c.isVerified ||
      c.invitedByProfile ||
      (c.vouchCount ?? 0) >= 1
    );
    const location = (c as any).neighborhoodName || c.campusName || c.campus || c.city || c.district || "Kigali";
    const myLat = (myProfile as any).latitude;
    const myLon = (myProfile as any).longitude;
    const cLat = (c as any).latitude;
    const cLon = (c as any).longitude;
    const distanceKm =
      typeof myLat === "number" && typeof myLon === "number" && typeof cLat === "number" && typeof cLon === "number"
        ? Math.round(haversineKm(myLat, myLon, cLat, cLon) * 10) / 10
        : null;

    return {
      id: c.id,
      firstName,
      age: c.dateOfBirth ? calculateAge(String(c.dateOfBirth)) : null,
      location,
      areaName: (c as any).neighborhoodName ?? c.district ?? c.campusName ?? c.city ?? "Kigali",
      distanceKm,
      campusName: c.campusName ?? c.campus ?? null,
      city: c.city ?? null,
      district: c.district ?? null,
      occupation: c.faculty ?? null,
      isUrStudent,
      isVerified,
      photos: candidatePhotos,
      primaryPhotoPath: candidatePhotos[0] ?? null,
      is_golden_bid: isGoldenBid,
      incoming_reaction: incomingReaction,
      intent_class: candidateIntent,
      primaryIntent: candidateIntent,
      trustScore: c.trustScore ?? 1,
      bio: c.bio ?? null,
      tags: (c.tags as string[]) ?? [],
      voiceIntroPath: c.voiceIntroPath ?? null,
      voiceIntroDurationMs: c.voiceIntroDurationMs ?? null,
      voiceBioUrl: (c as any).voiceBioUrl ?? null,
      heightCm: (c as any).heightCm ?? null,
      languages: (c as any).languages ?? ["Kinyarwanda", "English"],
      zodiacSign: (c as any).zodiacSign ?? null,
      isFreeTonight: Boolean((c as any).isFreeTonight),
      freeTonightNote: (c as any).freeTonightNote ?? null,
      isOnline: Boolean(c.lastActive && c.lastActive > new Date(Date.now() - 15 * 60 * 1000)),
      approvedBy: approvedByMap.get(c.id) ?? null,
      vouchedBy: approvedByMap.get(c.id) ?? null,
    };
  });

  const freeTonightOnly = req.query["freeTonight"] === "true";
  res.json(freeTonightOnly ? result.filter((r) => r.isFreeTonight) : result);
});

// GET /deck/top-picks — Daily Curated Top 5 Picks
router.get("/deck/top-picks", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(profilesTable)
    .where(and(ne(profilesTable.id, userId), eq(profilesTable.profileActive, true), eq(profilesTable.onboardingComplete, true)))
    .limit(5);

  const ids = rows.map((r) => r.id);
  const photos = ids.length
    ? await db
        .select({ userId: profilePhotosTable.userId, publicUrl: profilePhotosTable.publicUrl, storagePath: profilePhotosTable.storagePath })
        .from(profilePhotosTable)
        .where(inArray(profilePhotosTable.userId, ids))
        .orderBy(asc(profilePhotosTable.sortOrder))
    : [];
  const pMap = new Map<string, string[]>();
  for (const ph of photos) {
    if (!pMap.has(ph.userId)) pMap.set(ph.userId, []);
    const u = ph.publicUrl || ph.storagePath;
    if (u) pMap.get(ph.userId)!.push(u);
  }

  res.json(
    rows.map((c) => ({
      id: c.id,
      firstName: c.fullName?.trim().split(" ")[0] ?? "kinn Member",
      age: c.dateOfBirth ? calculateAge(String(c.dateOfBirth)) : null,
      location: c.campusName ?? c.city ?? "Kigali",
      primaryIntent: c.primaryIntent ?? "Serious",
      isVerified: Boolean(c.isVerified || c.institutionVerified),
      photos: pMap.get(c.id) ?? [],
      isFreeTonight: Boolean((c as any).isFreeTonight),
    }))
  );
});

// GET /deck/second-chance — Last 10 passed profiles
router.get("/deck/second-chance", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const passed = await db
    .select({ targetUserId: passesTable.targetUserId })
    .from(passesTable)
    .where(eq(passesTable.userId, userId))
    .limit(10);

  const ids = passed.map((p) => p.targetUserId);
  if (ids.length === 0) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({ id: profilesTable.id, fullName: profilesTable.fullName, campusName: profilesTable.campusName, city: profilesTable.city })
    .from(profilesTable)
    .where(inArray(profilesTable.id, ids));

  res.json(
    rows.map((r) => ({
      id: r.id,
      firstName: r.fullName?.trim().split(" ")[0] ?? "kinn Member",
      location: r.campusName ?? r.city ?? "Kigali",
    }))
  );
});

// POST /deck/second-chance/revive — 100 RWF MoMo revive passed profile
router.post("/deck/second-chance/revive", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { targetUserId } = req.body as { targetUserId?: string };
  if (!targetUserId) {
    res.status(400).json({ error: "missing_target" });
    return;
  }

  await db.insert(paymentsTable).values({
    userId,
    productType: "second_chance",
    amountRwf: 100,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  await db
    .delete(passesTable)
    .where(and(eq(passesTable.userId, userId), eq(passesTable.targetUserId, targetUserId)));

  res.json({ success: true });
});

// POST /deck/drink — Send Coffee (100 RWF) or Cocktail (200 RWF) on Deck
router.post("/deck/drink", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { targetUserId, drinkType, note } = req.body as {
    targetUserId?: string;
    drinkType?: "coffee" | "cocktail";
    note?: string;
  };
  if (!targetUserId) {
    res.status(400).json({ error: "missing_target" });
    return;
  }

  const type = drinkType === "cocktail" ? "cocktail" : "coffee";
  const amountRwf = type === "cocktail" ? 200 : 100;
  const defaultNote = type === "cocktail" ? "🍸 Sent you a Cocktail!" : "☕ Sent you a Coffee!";

  await db.insert(paymentsTable).values({
    userId,
    productType: `deck_${type}`,
    amountRwf,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  await db.insert(photoCommentsTable).values({
    senderId: userId,
    targetProfileId: targetUserId,
    photoUrl: null,
    commentText: (note?.trim() || defaultNote).slice(0, 140),
    giftType: type,
    amountRwf,
  } as any);

  res.json({ success: true, amountRwf, giftType: type });
});

export default router;
