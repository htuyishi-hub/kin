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
    onboardingComplete: p.onboardingComplete ?? false,
    phoneVerified: p.phoneVerified ?? false,
    idVerified: p.idVerified ?? false,
    proximityConsent: p.proximityConsent ?? false,
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

  // Lazily ensure user has an invite code
  if (!p.inviteCode) {
    const code = generateInviteCode();
    await db.update(profilesTable).set({ inviteCode: code }).where(eq(profilesTable.id, userId));
    p.inviteCode = code;
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

  const allowed = ["fullName", "gender", "dateOfBirth", "campusName", "faculty", "yearOfStudy", "hostelName", "city", "district", "proximityConsent"];
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

export default router;
