import { Router } from "express";
import { eq, and, sql, or } from "drizzle-orm";
import { db, profilesTable, profilePhotosTable, vouchesTable, paymentsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { getStorageAdmin } from "../lib/storage.js";
import type { Request } from "express";

import { generateInviteCode } from "../lib/inviteCode.js";
import { verifyURRegistration } from "./urVerification.js";
import { haversineKm } from "../lib/geo.js";
import { isWithinRwanda, detectRwandaHub } from "../lib/location.js";

const VOUCH_THRESHOLD = 1000;

const router = Router();

function mapProfile(p: typeof profilesTable.$inferSelect) {
  const isVerified = Boolean(
    p.isVerified ||
    p.institutionVerified ||
    p.invitedByProfile ||
    (p.vouchCount ?? 0) >= 1
  );

  const isVerifiedActive =
    isVerified &&
    (p.accountStatus === "active" || (!p.accountStatus && isVerified)) &&
    p.profileActive !== false &&
    p.profilePaused !== true;

  return {
    id: p.id,
    phoneNumber: p.phoneNumber,
    fullName: p.fullName ?? null,
    gender: p.gender ?? null,
    age: p.dateOfBirth ? calculateAge(p.dateOfBirth) : null,
    dateOfBirth: p.dateOfBirth ?? null,
    campusName: p.campusName ?? null,
    faculty: p.faculty ?? null,
    yearOfStudy: p.yearOfStudy ?? null,
    hostelName: p.hostelName ?? null,
    city: p.city ?? null,
    district: p.district ?? null,
    primaryIntent: p.primaryIntent ?? null,
    vouchCount: p.vouchCount ?? 0,
    inviteCode: isVerifiedActive ? p.inviteCode ?? null : null,
    inviteCount: p.inviteCount ?? 0,
    invitedByProfile: p.invitedByProfile ?? null,
    isVerified,
    verificationStatus: (p as any).verificationStatus ?? "none",
    isIncognito: Boolean((p as any).isIncognito ?? false),
    tokensRemaining: p.tokensRemaining ?? 0,
    crossingFeePaid: p.crossingFeePaid ?? false,
    profileActive: p.profileActive ?? true,
    profilePaused: p.profilePaused ?? false,
    onboardingComplete: Boolean(
      p.onboardingComplete &&
      p.fullName &&
      p.fullName.trim().length > 0 &&
      p.dateOfBirth &&
      p.gender &&
      p.gender.trim().length > 0 &&
      p.faculty &&
      p.faculty.trim().length > 0 &&
      p.primaryIntent &&
      p.primaryIntent.trim().length > 0
    ),
    phoneVerified: p.phoneVerified ?? false,
    idVerified: p.idVerified ?? false,
    proximityConsent: p.proximityConsent ?? false,
    readReceiptsEnabled: Boolean(p.readReceiptsEnabled ?? false),
    hideFromPeople: Boolean(p.hideFromPeople ?? false),
    language: (p as any).language ?? "en",
    bio: p.bio ?? null,
    tags: (p.tags as string[]) ?? [],
    voiceIntroPath: p.voiceIntroPath ?? null,
    voiceIntroDurationMs: p.voiceIntroDurationMs ?? null,
    voiceBioUrl: (p as any).voiceBioUrl ?? null,
    heightCm: (p as any).heightCm ?? null,
    languages: (p as any).languages ?? ["Kinyarwanda", "English"],
    zodiacSign: (p as any).zodiacSign ?? null,
    isFreeTonight: Boolean((p as any).isFreeTonight),
    freeTonightNote: (p as any).freeTonightNote ?? null,
    passportCity: (p as any).passportCity ?? null,
    passportUntil: (p as any).passportUntil ? new Date((p as any).passportUntil).toISOString() : null,
    facultyFlair: (p as any).facultyFlair ?? null,
    isVoiceVerified: Boolean((p as any).isVoiceVerified),
    vibeWeekend: (p as any).vibeWeekend ?? null,
    vibeFirstDate: (p as any).vibeFirstDate ?? null,
    vibeGetaway: (p as any).vibeGetaway ?? null,
    communityVotingEnabled: process.env.COMMUNITY_VOTING_ENABLED === "true",
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    lastActive: p.lastActive ? new Date(p.lastActive).toISOString() : new Date().toISOString(),
  };
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

// GET /me
router.get("/me", requireAuth, async (req, res) => {
  // Prevent browser/proxy caching of auth/profile data.
  // React Query relies on fresh profile state during onboarding.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const authed = req as AuthedRequest;
  const userId = authed.userId;
  const userEmail = authed.userEmail;
  const userPhone = authed.userPhone;
  const userName = authed.userName;

  try {
    (req as any).log?.info?.({ userId }, "GET /me");
  } catch {
    // ignore logging failures
  }

  try {
    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(profilesTable)
        .where(
          or(
            eq(profilesTable.id, userId),
            userEmail ? eq(profilesTable.email, userEmail) : sql`false`,
            eq(profilesTable.googleId, userId)
          )
        )
        .limit(1),
      db.select({ count: sql<number>`count(*)` }).from(profilesTable),
    ]);

    let p = rows[0] as any;

    if (!p) {
      try {
        const fallbackPhone = userPhone || `user:${userId}`;
        const [created] = await db
          .insert(profilesTable)
          .values({
            id: userId,
            phoneNumber: fallbackPhone,
            email: userEmail ?? null,
            fullName: userName ?? null,
            googleId: userId,
            inviteCode: generateInviteCode(),
            tokensRemaining: 3,
            profileActive: true,
            accountStatus: "waitlisted",
          } as any)
          .onConflictDoNothing()
          .returning();
        p = created || (await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1))[0];
      } catch (err) {
        console.error("[GET /me] Failed to create initial profile:", err);
        p = (await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1))[0];
      }
    }

    if (!p) {
      try {
        (req as any).log?.warn?.({ userId }, "GET /me: profile not found");
      } catch {
        // ignore logging failures
      }

      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }

    // Lazily provide invite code for response without writing to database during GET
    if (!p.inviteCode) {
      p.inviteCode = generateInviteCode();
    }

    const totalUsers = Number(countResult[0]?.count ?? 0);
    const earlyAccess = totalUsers < VOUCH_THRESHOLD;
    const baseUrl = (process.env["APP_URL"] ?? "https://kinn.ink").replace(/\/+$/, "");
    const isVerified = Boolean(
      p.isVerified ||
      p.institutionVerified ||
      p.invitedByProfile ||
      (p.vouchCount ?? 0) >= 1
    );

    const [photoCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profilePhotosTable)
      .where(eq(profilePhotosTable.userId, p.id));
    const photoCount = photoCountRow?.count ?? 0;

    // Fetch confirmed voucher details for Trust Chain badge safely
    let vouchedBy: any = null;
    try {
      const vouchRows = await db
        .select({
          voucherId: vouchesTable.voucher,
          voucherFullName: profilesTable.fullName,
          voucherIsVerified: profilesTable.isVerified,
          voucherInstitutionVerified: profilesTable.institutionVerified,
        })
        .from(vouchesTable)
        .innerJoin(profilesTable, eq(vouchesTable.voucher, profilesTable.id))
        .where(and(eq(vouchesTable.vouchedUser, p.id), eq(vouchesTable.status, "confirmed")))
        .limit(1);

      if (vouchRows[0]) {
        vouchedBy = {
          id: vouchRows[0].voucherId,
          fullName: vouchRows[0].voucherFullName ?? "Community Member",
          firstName: vouchRows[0].voucherFullName ? vouchRows[0].voucherFullName.trim().split(" ")[0] : "Member",
          isVerified: Boolean(vouchRows[0].voucherIsVerified || vouchRows[0].voucherInstitutionVerified),
        };
      }
    } catch (vouchErr) {
      console.warn("[GET /me] Could not fetch vouch details:", vouchErr);
    }

    const accountStatus = p.accountStatus ?? (isVerified || earlyAccess ? "active" : "waitlisted");
    const isVerifiedActive =
      isVerified &&
      accountStatus === "active" &&
      p.profileActive !== false &&
      p.profilePaused !== true;

    const inviteCode = p.inviteCode ?? null;
    const inviteLink = inviteCode ? `${baseUrl}/invite/${inviteCode}` : null;

    res.json({
      ...mapProfile(p),
      photoCount,
      account_status: accountStatus,
      accountStatus: accountStatus,
      invite_code: inviteCode,
      invite_link: inviteLink,
      inviteCode: inviteCode,
      inviteLink: inviteLink,
      invite_count: p.inviteCount ?? 0,
      is_verified: isVerified,
      institution_verified: p?.institutionVerified ?? false,
      institution: p?.institution ?? null,
      verification_method: p?.verificationMethod ?? null,
      registration_number: p?.registrationNumber ?? null,
      campus: p?.campus ?? null,
      earlyAccess,
      vouched_by: vouchedBy,
      vouchedBy,
    });
  } catch (err: any) {
    console.error("[GET /me] internal error", err);
    res.status(500).json({ error: "server_error", message: err?.message || "Failed to load profile" });
  }
});



// PATCH /me
router.patch("/me", requireAuth, async (req, res) => {
  const authed = req as AuthedRequest;
  const userId = authed.userId;
  const userEmail = authed.userEmail;
  const userPhone = authed.userPhone;
  const userName = authed.userName;
  const body = req.body as Record<string, unknown>;

  const allowed = ["fullName", "phoneNumber", "gender", "dateOfBirth", "campusName", "campusZone", "faculty", "yearOfStudy", "hostelName", "city", "district", "proximityConsent", "language", "primaryIntent", "readReceiptsEnabled", "hideFromPeople", "onboardingComplete"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (typeof updates.phoneNumber === "string") {
    updates.phoneNumber = updates.phoneNumber.replace(/\s+/g, "");
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "bad_request", message: "No valid fields to update" });
    return;
  }

  if (updates.onboardingComplete === true) {
    const rwPhoneRegex = /^(07[2389]\d{7}|\+2507[2389]\d{7})$/;
    const candidatePhone = typeof updates.phoneNumber === "string"
      ? updates.phoneNumber
      : (await db.select({ phoneNumber: profilesTable.phoneNumber }).from(profilesTable).where(eq(profilesTable.id, userId)).limit(1))[0]?.phoneNumber ?? "";
    const cleanPhone = String(candidatePhone).replace(/\s+/g, "");
    if (!cleanPhone || !rwPhoneRegex.test(cleanPhone)) {
      res.status(400).json({
        error: "PHONE_NUMBER_REQUIRED",
        message: "A valid Rwandan MTN or Airtel phone number (078/079/072/073) is required",
      });
      return;
    }

    const [photoRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profilePhotosTable)
      .where(eq(profilePhotosTable.userId, userId));
    if ((photoRow?.count ?? 0) === 0) {
      res.status(400).json({
        error: "photo_required",
        code: "PHOTO_REQUIRED",
        message: "At least 1 profile photo is required.",
      });
      return;
    }
  }

  if (body.dateOfBirth) {
    const age = calculateAge(String(body.dateOfBirth));
    if (isNaN(age) || age < 18) {
      res.status(400).json({ error: "underage", code: "UNDERAGE", message: "Must be at least 18 years old" });
      return;
    }
  }

  try {
    let [updated] = await db
      .update(profilesTable)
      .set(updates as any)
      .where(
        or(
          eq(profilesTable.id, userId),
          userEmail ? eq(profilesTable.email, userEmail) : sql`false`,
          eq(profilesTable.googleId, userId)
        )
      )
      .returning();

    if (!updated) {
      const fallbackPhone = userPhone || `user:${userId}`;
      const fallbackEmail = userEmail || null;
      const fallbackName = (updates.fullName as string) || userName || null;

      const [created] = await db
        .insert(profilesTable)
        .values({
          id: userId,
          phoneNumber: fallbackPhone,
          email: fallbackEmail,
          fullName: fallbackName,
          googleId: userId,
          inviteCode: generateInviteCode(),
          tokensRemaining: 3,
          profileActive: true,
          accountStatus: "waitlisted",
          ...updates,
        } as any)
        .onConflictDoNothing()
        .returning();
      updated = created || (await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1))[0];
    }

    if (!updated) {
      return res.status(404).json({ error: "not_found", message: "Profile not found" });
    }

    res.json(mapProfile(updated!));
  } catch (err: any) {
    console.error("[PATCH /me] update failed", err);
    return res.status(500).json({
      error: "server_error",
      message: err?.message || "Failed to update profile",
      detail: String(err),
    });
  }
  return;
});

// POST /me/onboarding — invisible tier classification
router.post("/me/onboarding", requireAuth, async (req, res) => {
  const authed = req as AuthedRequest;
  const userId = authed.userId;
  const userEmail = authed.userEmail;
  const userPhone = authed.userPhone;
  let { occupation, locationType, primaryGoal, campusName, fullName, gender, dateOfBirth } =
    req.body as {
      occupation?: string;
      locationType?: string;
      primaryGoal?: string;
      campusName?: string;
      fullName?: string;
      gender?: string;
      dateOfBirth?: string;
    };

  const [existingProfile] = await db
    .select()
    .from(profilesTable)
    .where(
      or(
        eq(profilesTable.id, userId),
        userEmail ? eq(profilesTable.email, userEmail) : sql`false`,
        eq(profilesTable.googleId, userId)
      )
    )
    .limit(1);

  fullName = fullName || existingProfile?.fullName || undefined;
  gender = gender || existingProfile?.gender || undefined;
  dateOfBirth = dateOfBirth || (existingProfile?.dateOfBirth ? String(existingProfile.dateOfBirth) : undefined);
  locationType = locationType || (occupation === "Student" ? "Campus" : "City");

  if (!occupation || !locationType || !primaryGoal || !fullName || !gender || !dateOfBirth) {
    res.status(400).json({ error: "bad_request", message: "All onboarding fields are required" });
    return;
  }

  const age = calculateAge(dateOfBirth);
  if (isNaN(age) || age < 18) {
    res.status(400).json({ error: "underage", code: "UNDERAGE", message: "Must be at least 18 years old" });
    return;
  }

  const targetPhotoUserId = existingProfile?.id ?? userId;
  const [photoCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, targetPhotoUserId));

  if ((photoCountRow?.count ?? 0) === 0) {
    res.status(400).json({
      error: "photo_required",
      code: "PHOTO_REQUIRED",
      message: "At least 1 profile photo is required.",
    });
    return;
  }

  // Invisible tier classification
  let hiddenTier = 1;
  if (occupation === "Student") hiddenTier = 1;
  else if (occupation === "Employed" || occupation === "Business") hiddenTier = 2;
  else hiddenTier = 3;

  const intentMap: Record<string, string> = {
    "Serious Marriage": "Marriage",
    "Long-term Relationship": "Serious",
    "Casual Dating": "Casual",
    "marriage": "Marriage",
    "long_term": "Serious",
    "casual": "Casual",
    "Marriage": "Marriage",
    "Serious": "Serious",
    "Casual": "Casual",
  };
  const primaryIntent = intentMap[primaryGoal] ?? "Serious";

  let [updated] = await db
    .update(profilesTable)
    .set({
      hiddenTier: hiddenTier as any,
      primaryIntent,
      intentClass: primaryIntent,
      faculty: occupation,
      campusName: campusName ?? null,
      fullName,
      gender,
      dateOfBirth,
      accountStatus: "active",
      verifiedAdult: true,
      onboardingComplete: true,
    })
    .where(
      or(
        eq(profilesTable.id, userId),
        userEmail ? eq(profilesTable.email, userEmail) : sql`false`,
        eq(profilesTable.googleId, userId)
      )
    )
    .returning();

  if (!updated) {
    const fallbackPhone = userPhone || `user:${userId}`;
    const fallbackEmail = userEmail || null;

    const [created] = await db
      .insert(profilesTable)
      .values({
        id: userId,
        phoneNumber: fallbackPhone,
        email: fallbackEmail,
        googleId: userId,
        inviteCode: generateInviteCode(),
        tokensRemaining: 3,
        profileActive: true,
        accountStatus: "active",
        verifiedAdult: true,
        hiddenTier: hiddenTier as any,
        primaryIntent,
        intentClass: primaryIntent,
        faculty: occupation,
        campusName: campusName ?? null,
        fullName,
        gender,
        dateOfBirth,
        onboardingComplete: true,
      } as any)
      .onConflictDoNothing()
      .returning();
    updated = created || (await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1))[0];
  }

  res.json(mapProfile(updated!));
});

// POST /me/pause
router.post("/me/pause", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { paused } = req.body as { paused?: boolean };
  if (typeof paused !== "boolean") {
    res.status(400).json({ error: "bad_request", message: "paused must be a boolean" });
    return;
  }
  const [updated] = await db
    .update(profilesTable)
    .set({ profilePaused: paused })
    .where(eq(profilesTable.id, userId))
    .returning();
  res.json(mapProfile(updated!));
});

// POST /me/push-token — store Expo push notification token
router.post("/me/push-token", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { token } = req.body as { token?: string };

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    res.status(400).json({ error: "bad_request", message: "token is required" });
    return;
  }

  await db
    .update(profilesTable)
    .set({ pushNotificationToken: token.trim() } as any)
    .where(eq(profilesTable.id, userId));

  res.json({ ok: true });
});

// POST /me/exit — archive profile, move to real life
router.post("/me/exit", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  await db.update(profilesTable).set({ profileActive: false }).where(eq(profilesTable.id, userId));
  res.json({ message: "Profile archived. Go build something beautiful." });
});

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

const ALLOWED_TAGS = new Set([
  "faith",
  "family",
  "career",
  "education",
  "business",
  "travel",
  "music",
  "football",
  "humor",
  "kindness",
  "honesty",
  "ambition",
  "nature",
  "cooking",
  "reading",
  "art",
  "fitness",
  "technology",
  "community",
  "culture",
]);

// 10 edits / 24 hours per user
const profileExtrasRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkAndIncrementRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = profileExtrasRateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    profileExtrasRateLimit.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count += 1;
  return true;
}

function containsContactInfo(text: string): boolean {
  if (!text) return false;

  // 1. Phone numbers:
  // Rwandan patterns (07..., +250..., 250...) or 9+ digits with optional spaces/dots/dashes
  const phonePattern = /(?:\+?250[\s.-]*)?0?7[2389][\s.-]*(?:\d[\s.-]*){7}/;
  const genericDigitsPattern = /(?:\d[\s.-]*){9,}/;
  if (phonePattern.test(text) || genericDigitsPattern.test(text)) {
    return true;
  }

  // 2. Email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailPattern.test(text)) {
    return true;
  }

  // 3. URLs, protocols or common domain extensions
  const urlPattern = /(?:https?:\/\/|www\.|\b\S+\.(?:com|rw|org|net|io|me|app|info|co|xyz|gov|edu)\b)/i;
  if (urlPattern.test(text)) {
    return true;
  }

  // 4. Social handles: @username
  const handlePattern = /@[\w.]{2,}/;
  if (handlePattern.test(text)) {
    return true;
  }

  // 5. Social / chat app keywords
  const socialKeywordsPattern = /\b(?:whatsapp|telegram|instagram|insta|snapchat|snap|tiktok|facebook|fb|ig)\b/i;
  if (socialKeywordsPattern.test(text)) {
    return true;
  }

  return false;
}

// PATCH /me/profile-extras
router.patch("/me/profile-extras", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const body = req.body as {
    bio?: string | null;
    tags?: string[] | null;
    voiceIntroPath?: string | null;
    voiceIntroDurationMs?: number | null;
  };

  // Check rate limit: 10 edits / 24 hours
  if (!checkAndIncrementRateLimit(userId)) {
    res.status(429).json({
      code: "TOO_MANY_EDITS",
      error: "too_many_requests",
      message: "Daily edit limit reached. Try again tomorrow.",
    });
    return;
  }

  const updates: {
    bio?: string | null;
    tags?: string[] | null;
    voiceIntroPath?: string | null;
    voiceIntroDurationMs?: number | null;
  } = {};

  if (body.bio !== undefined) {
    if (body.bio === null || body.bio.trim() === "") {
      updates.bio = null;
    } else {
      const trimmedBio = body.bio.trim();
      if (trimmedBio.length > 140) {
        res.status(400).json({
          code: "BIO_TOO_LONG",
          error: "bad_request",
          message: "Bio must be 140 characters or fewer.",
        });
        return;
      }
      if (containsContactInfo(trimmedBio)) {
        res.status(400).json({
          code: "BIO_CONTACT_INFO",
          error: "bad_request",
          message: "Contact information is not allowed in bio.",
        });
        return;
      }
      updates.bio = trimmedBio;
    }
  }

  if (body.tags !== undefined) {
    if (body.tags === null) {
      updates.tags = [];
    } else if (Array.isArray(body.tags)) {
      // Deduplicate tags while preserving order
      const uniqueTags = Array.from(new Set(body.tags.map((t) => String(t).trim().toLowerCase())));
      if (uniqueTags.length > 5) {
        res.status(400).json({
          code: "TAGS_LIMIT_EXCEEDED",
          error: "bad_request",
          message: "You can select up to 5 tags.",
        });
        return;
      }
      for (const tag of uniqueTags) {
        if (!ALLOWED_TAGS.has(tag)) {
          res.status(400).json({
            code: "INVALID_TAG",
            error: "bad_request",
            message: `Invalid tag: ${tag}`,
          });
          return;
        }
      }
      updates.tags = uniqueTags;
    } else {
      res.status(400).json({
        code: "INVALID_TAGS",
        error: "bad_request",
        message: "Tags must be an array of strings.",
      });
      return;
    }
  }

  if (body.voiceIntroPath !== undefined) {
    updates.voiceIntroPath = body.voiceIntroPath;
  }

  if (body.voiceIntroDurationMs !== undefined) {
    if (body.voiceIntroDurationMs !== null) {
      const dur = Number(body.voiceIntroDurationMs);
      if (dur > 30000) {
        res.status(400).json({
          code: "VOICE_INTRO_TOO_LONG",
          error: "bad_request",
          message: "Voice intro must be 30 seconds or fewer.",
        });
        return;
      }
      if (dur < 1000) {
        res.status(400).json({
          code: "VOICE_INTRO_TOO_SHORT",
          error: "bad_request",
          message: "Voice intro must be at least 1 second.",
        });
        return;
      }
      updates.voiceIntroDurationMs = Math.round(dur);
    } else {
      updates.voiceIntroDurationMs = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      error: "bad_request",
      message: "No valid profile extras to update",
    });
    return;
  }

  try {
    const [updated] = await db
      .update(profilesTable)
      .set(updates as any)
      .where(eq(profilesTable.id, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }

    res.json(mapProfile(updated));
  } catch (err) {
    console.error("[PATCH /me/profile-extras] update failed", err);
    res.status(500).json({ error: "server_error", message: "Failed to update profile extras" });
  }
});

// POST /me/voice-intro
router.post("/me/voice-intro", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { storagePath, durationMs } = req.body as {
    storagePath?: string;
    durationMs?: number;
  };

  if (!storagePath || typeof storagePath !== "string" || storagePath.trim() === "") {
    res.status(400).json({
      code: "INVALID_STORAGE_PATH",
      error: "bad_request",
      message: "storagePath is required",
    });
    return;
  }

  const dur = Number(durationMs);
  if (!durationMs || isNaN(dur) || dur < 1000) {
    res.status(400).json({
      code: "VOICE_INTRO_TOO_SHORT",
      error: "bad_request",
      message: "Voice intro must be at least 1 second.",
    });
    return;
  }

  if (dur > 30000) {
    res.status(400).json({
      code: "VOICE_INTRO_TOO_LONG",
      error: "bad_request",
      message: "Voice intro must be 30 seconds or fewer.",
    });
    return;
  }

  if (!checkAndIncrementRateLimit(userId)) {
    res.status(429).json({
      code: "TOO_MANY_EDITS",
      error: "too_many_requests",
      message: "Daily edit limit reached. Try again tomorrow.",
    });
    return;
  }

  try {
    const [updated] = await db
      .update(profilesTable)
      .set({
        voiceIntroPath: storagePath.trim(),
        voiceIntroDurationMs: Math.round(dur),
      } as any)
      .where(eq(profilesTable.id, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }

    res.json(mapProfile(updated));
  } catch (err) {
    console.error("[POST /me/voice-intro] upload failed", err);
    res.status(500).json({ error: "server_error", message: "Failed to upload voice intro" });
  }
});

// DELETE /me/voice-intro
router.delete("/me/voice-intro", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  try {
    const [existing] = await db
      .select({ voiceIntroPath: profilesTable.voiceIntroPath })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);

    if (existing?.voiceIntroPath) {
      try {
        const admin = getStorageAdmin();
        if (admin) {
          await admin.storage.from("voice-intros").remove([existing.voiceIntroPath]);
        }
      } catch (err) {
        console.warn("[DELETE /me/voice-intro] storage removal failed:", err);
      }
    }

    const [updated] = await db
      .update(profilesTable)
      .set({
        voiceIntroPath: null,
        voiceIntroDurationMs: null,
      } as any)
      .where(eq(profilesTable.id, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }

    res.json(mapProfile(updated));
  } catch (err) {
    console.error("[DELETE /me/voice-intro] delete failed", err);
    res.status(500).json({ error: "server_error", message: "Failed to delete voice intro" });
  }
});

// POST /me/verify-selfie — Selfie Verification Shield (✓ Verified)
router.post("/me/verify-selfie", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const [updated] = await db
    .update(profilesTable)
    .set({
      isVerified: true,
      verificationStatus: "verified",
    })
    .where(eq(profilesTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  res.json({
    success: true,
    isVerified: true,
    verificationStatus: "verified",
    profile: mapProfile(updated),
  });
});

// PATCH /me/privacy — Incognito Mode toggle
router.patch("/me/privacy", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { isIncognito } = req.body as { isIncognito?: boolean };

  if (typeof isIncognito !== "boolean") {
    res.status(400).json({ error: "bad_request", message: "isIncognito must be a boolean" });
    return;
  }

  const [updated] = await db
    .update(profilesTable)
    .set({ isIncognito })
    .where(eq(profilesTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  res.json({
    success: true,
    isIncognito: Boolean(updated.isIncognito),
    profile: mapProfile(updated),
  });
});

// PATCH /me/free-tonight — Toggle Free Tonight status
router.patch("/me/free-tonight", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { isFreeTonight, note } = req.body as { isFreeTonight?: boolean; note?: string };
  const [updated] = await db
    .update(profilesTable)
    .set({
      isFreeTonight: Boolean(isFreeTonight),
      freeTonightNote: typeof note === "string" ? note.trim().slice(0, 140) : null,
    } as any)
    .where(eq(profilesTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ success: true, profile: mapProfile(updated) });
});

// POST /me/passport — 200 RWF Weekend Travel Passport (48h)
router.post("/me/passport", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { city } = req.body as { city?: string };
  const cleanCity = String(city || "Rubavu").trim();
  const passportUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db.insert(paymentsTable).values({
    userId,
    productType: "weekend_passport",
    amountRwf: 200,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  const [updated] = await db
    .update(profilesTable)
    .set({
      passportCity: cleanCity,
      passportUntil,
    } as any)
    .where(eq(profilesTable.id, userId))
    .returning();

  res.json({
    success: true,
    passportCity: cleanCity,
    passportUntil: passportUntil.toISOString(),
    profile: updated ? mapProfile(updated) : null,
  });
});

// POST /me/voice-bio — Save 15s voice bio URL
router.post("/me/voice-bio", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { voiceBioUrl } = req.body as { voiceBioUrl?: string };
  if (!voiceBioUrl) {
    res.status(400).json({ error: "missing_url" });
    return;
  }
  const [updated] = await db
    .update(profilesTable)
    .set({ voiceBioUrl } as any)
    .where(eq(profilesTable.id, userId))
    .returning();
  res.json({ success: true, voiceBioUrl, profile: updated ? mapProfile(updated) : null });
});

// POST /me/location — Real Rwanda Geofence + Neighborhood Confirmation + Travel Detection
router.post("/me/location", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { latitude, longitude, confirm } = req.body as {
    latitude?: number;
    longitude?: number;
    confirm?: boolean;
  };
  if (typeof latitude !== "number" || typeof longitude !== "number" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({ error: "invalid_coordinates" });
    return;
  }

  if (!isWithinRwanda(latitude, longitude)) {
    res.status(403).json({
      error: "LOCATION_UNSUPPORTED",
      message: "Kinn is exclusively available for verified daters physically inside Rwanda.",
    });
    return;
  }

  const detectedNeighborhood = detectRwandaHub(latitude, longitude);
  const [existing] = await db
    .select({
      latitude: profilesTable.latitude,
      longitude: profilesTable.longitude,
      neighborhoodName: profilesTable.neighborhoodName,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  const prevLat = existing?.latitude;
  const prevLon = existing?.longitude;
  const travelShiftKm =
    typeof prevLat === "number" && typeof prevLon === "number"
      ? Math.round(haversineKm(prevLat, prevLon, latitude, longitude) * 10) / 10
      : null;

  if (!confirm && (!existing?.neighborhoodName || (travelShiftKm !== null && travelShiftKm > 15))) {
    res.json({
      success: true,
      requiresConfirmation: true,
      isTravelShift: Boolean(travelShiftKm !== null && travelShiftKm > 15),
      travelShiftKm,
      detectedNeighborhood,
      latitude,
      longitude,
    });
    return;
  }

  const [updated] = await db
    .update(profilesTable)
    .set({
      latitude,
      longitude,
      neighborhoodName: detectedNeighborhood,
      locationUpdatedAt: new Date(),
    } as any)
    .where(eq(profilesTable.id, userId))
    .returning();

  res.json({
    success: true,
    confirmed: true,
    latitude,
    longitude,
    neighborhoodName: detectedNeighborhood,
    profile: updated ? mapProfile(updated) : null,
  });
});

// PATCH /me/vibe — Update 3-Question Vibe Check & Faculty Flair
router.patch("/me/vibe", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { vibeWeekend, vibeFirstDate, vibeGetaway, facultyFlair } = req.body as {
    vibeWeekend?: string;
    vibeFirstDate?: string;
    vibeGetaway?: string;
    facultyFlair?: string;
  };
  const updates: Record<string, unknown> = {};
  if (typeof vibeWeekend === "string") updates.vibeWeekend = vibeWeekend;
  if (typeof vibeFirstDate === "string") updates.vibeFirstDate = vibeFirstDate;
  if (typeof vibeGetaway === "string") updates.vibeGetaway = vibeGetaway;
  if (typeof facultyFlair === "string") updates.facultyFlair = facultyFlair.trim().slice(0, 60);

  const [updated] = await db
    .update(profilesTable)
    .set(updates as any)
    .where(eq(profilesTable.id, userId))
    .returning();
  res.json({ success: true, profile: updated ? mapProfile(updated) : null });
});

// POST /me/verify-voice — Mark profile as voice verified
router.post("/me/verify-voice", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const [updated] = await db
    .update(profilesTable)
    .set({ isVoiceVerified: true } as any)
    .where(eq(profilesTable.id, userId))
    .returning();
  res.json({ success: true, isVoiceVerified: true, profile: updated ? mapProfile(updated) : null });
});

// UR registration verification
router.post("/me/ur/verify-registration", requireAuth, verifyURRegistration);

export default router;
