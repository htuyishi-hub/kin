import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, profilesTable, vouchesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import type { Request } from "express";

import { generateInviteCode } from "../lib/inviteCode.js";

const VOUCH_THRESHOLD = 1000;

const router = Router();

function mapProfile(p: typeof profilesTable.$inferSelect) {
  const isVerified = Boolean(
    p.isVerified ||
    p.institutionVerified ||
    p.invitedByProfile ||
    (p.vouchCount ?? 0) >= 1
  );

  return {
    id: p.id,
    phoneNumber: p.phoneNumber,
    fullName: p.fullName ?? null,
    gender: p.gender ?? null,
    age: p.dateOfBirth ? calculateAge(p.dateOfBirth) : null,
    campusName: p.campusName ?? null,
    faculty: p.faculty ?? null,
    yearOfStudy: p.yearOfStudy ?? null,
    hostelName: p.hostelName ?? null,
    city: p.city ?? null,
    district: p.district ?? null,
    primaryIntent: p.primaryIntent ?? null,
    vouchCount: p.vouchCount ?? 0,
    inviteCode: p.inviteCode ?? null,
    inviteCount: p.inviteCount ?? 0,
    invitedByProfile: p.invitedByProfile ?? null,
    isVerified,
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
    language: (p as any).language ?? "en",
    bio: p.bio ?? null,
    tags: (p.tags as string[]) ?? [],
    createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    lastActive: p.lastActive?.toISOString() ?? new Date().toISOString(),
  };
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// GET /me
router.get("/me", requireAuth, async (req, res) => {
  // Prevent browser/proxy caching of auth/profile data.
  // React Query relies on fresh profile state during onboarding.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const userId = (req as AuthedRequest).userId;


  try {
    (req as any).log?.info?.({ userId }, "GET /me");
  } catch {
    // ignore logging failures
  }

  const [rows, countResult] = await Promise.all([
    db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1),
    db.select({ count: sql<number>`count(*)` }).from(profilesTable),
  ]);

  if (!rows[0]) {
    try {
      (req as any).log?.warn?.({ userId }, "GET /me: profile not found");
    } catch {
      // ignore logging failures
    }

    res.status(404).json({ error: "not_found", message: "Profile not found" });
    return;
  }

  let p = rows[0] as any;

  // Lazily provide invite code for response without writing to database during GET
  if (!p.inviteCode) {
    p.inviteCode = generateInviteCode();
  }

  try {
    (req as any).log?.info?.(
      {
        profileFound: true,
        institutionVerified: p?.institutionVerified,
        registrationNumber: p?.registrationNumber,
        inviteCode: p?.inviteCode,
      },
      "GET /me: Loaded profile",
    );
  } catch {
    // ignore logging failures
  }

  const totalUsers = Number(countResult[0]?.count ?? 0);
  const earlyAccess = totalUsers < VOUCH_THRESHOLD;
  const baseUrl = process.env["APP_URL"] ?? "https://kin.rw";
  const isVerified = Boolean(
    p.isVerified ||
    p.institutionVerified ||
    p.invitedByProfile ||
    (p.vouchCount ?? 0) >= 1
  );

  // Fetch confirmed voucher details for Trust Chain badge
  const vouchRows = await db
    .select({
      voucherId: vouchesTable.voucher,
      voucherFullName: profilesTable.fullName,
      voucherIsVerified: profilesTable.isVerified,
      voucherInstitutionVerified: profilesTable.institutionVerified,
    })
    .from(vouchesTable)
    .innerJoin(profilesTable, eq(vouchesTable.voucher, profilesTable.id))
    .where(and(eq(vouchesTable.vouchedUser, userId), eq(vouchesTable.status, "confirmed")))
    .limit(1);

  const vouchedBy = vouchRows[0]
    ? {
        id: vouchRows[0].voucherId,
        fullName: vouchRows[0].voucherFullName ?? "Community Member",
        firstName: vouchRows[0].voucherFullName ? vouchRows[0].voucherFullName.trim().split(" ")[0] : "Member",
        isVerified: Boolean(vouchRows[0].voucherIsVerified || vouchRows[0].voucherInstitutionVerified),
      }
    : null;

  const accountStatus = p.accountStatus ?? (isVerified || earlyAccess ? "active" : "waitlisted");

  res.json({
    ...mapProfile(p),
    account_status: accountStatus,
    accountStatus: accountStatus,
    invite_code: p.inviteCode,
    invite_link: `${baseUrl}/invite/${p.inviteCode}`,
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
});



// PATCH /me
router.patch("/me", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const body = req.body as Record<string, unknown>;

  const allowed = ["fullName", "gender", "dateOfBirth", "campusName", "faculty", "yearOfStudy", "hostelName", "city", "district", "proximityConsent", "language"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[camelToSnake(key)] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "bad_request", message: "No valid fields to update" });
    return;
  }

  try {
    // Debugging: helps identify why PATCH /me is failing with 500
    console.error("[PATCH /me] userId", { userId });
    console.error("[PATCH /me] req.body", { body });
    console.error("[PATCH /me] updates", { updates });

    const [updated] = await db
      .update(profilesTable)
      .set(updates as any)
      .where(eq(profilesTable.id, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "not_found", message: "Profile not found" });
    }

    res.json(mapProfile(updated!));
  } catch (err) {
    console.error("[PATCH /me] update failed", err);
    return res.status(500).json({ error: "server_error", message: "Failed to update profile" });
  }
  // Ensure TS7030: all code paths return
  return;
});

// POST /me/onboarding — invisible tier classification
router.post("/me/onboarding", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { occupation, locationType, primaryGoal, campusName, fullName, gender, dateOfBirth } =
    req.body as {
      occupation?: string;
      locationType?: string;
      primaryGoal?: string;
      campusName?: string;
      fullName?: string;
      gender?: string;
      dateOfBirth?: string;
    };

  if (!occupation || !locationType || !primaryGoal || !fullName || !gender || !dateOfBirth) {
    res.status(400).json({ error: "bad_request", message: "All onboarding fields are required" });
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
  };
  const primaryIntent = intentMap[primaryGoal] ?? "Serious";

  const [updated] = await db
    .update(profilesTable)
    .set({
      hiddenTier: hiddenTier as any,
      primaryIntent,
      faculty: occupation,
      campusName: campusName ?? null,
      fullName,
      gender,
      dateOfBirth,
      onboardingComplete: true,
    })
    .where(eq(profilesTable.id, userId))
    .returning();

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
  const body = req.body as { bio?: string | null; tags?: string[] | null };

  // Check rate limit: 10 edits / 24 hours
  if (!checkAndIncrementRateLimit(userId)) {
    res.status(429).json({
      code: "TOO_MANY_EDITS",
      error: "too_many_requests",
      message: "Daily edit limit reached. Try again tomorrow.",
    });
    return;
  }

  const updates: { bio?: string | null; tags?: string[] | null } = {};

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

export default router;
