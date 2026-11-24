import { Router } from "express";
import { eq, and, gt, isNull, lt } from "drizzle-orm";
import { randomInt } from "crypto";
import { db, otpSessionsTable, profilesTable, invitesTable, trustEventsTable } from "@workspace/db";
import { signToken } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";
import { generateInviteCode } from "../lib/inviteCode.js";

const router = Router();

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

async function sendSmsOtp(phoneNumber: string, otp: string, lang: "en" | "rw" = "en"): Promise<void> {
  const username = process.env["AT_USERNAME"];
  const apiKey   = process.env["AT_API_KEY"];
  const senderId = process.env["AT_SENDER_ID"] ?? "KIN";

  if (!username || !apiKey) {
    logger.warn({ phoneNumber }, "Africa's Talking credentials not set — OTP not sent via SMS");
    return;
  }

  const AfricasTalking = (await import("africastalking")).default;
  const at = AfricasTalking({ username, apiKey });
  const sms = at.SMS;

  const message = lang === "rw"
    ? `Kode yawe yo kwemeza ya kinn ni ${otp}. Irangira mu minota 10. Ntuyisangize undi muntu.`
    : `Your kinn verification code is ${otp}. It expires in 10 minutes. Do not share it.`;

  await sms.send({
    to:      [phoneNumber],
    message,
    from:    senderId,
  });
}

// POST /auth/send-otp
router.post("/auth/send-otp", async (req, res) => {
  const { phoneNumber, lang } = req.body as { phoneNumber?: string; lang?: "en" | "rw" };
  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ error: "bad_request", message: "phoneNumber is required" });
    return;
  }

  const otp       = generateOtp();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  // Invalidate any previous unused sessions for this number
  await db
    .update(otpSessionsTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(otpSessionsTable.phoneNumber, phoneNumber),
        isNull(otpSessionsTable.usedAt),
        gt(otpSessionsTable.expiresAt, now),
      ),
    );

  await db.insert(otpSessionsTable).values({ phoneNumber, code: otp, expiresAt });

  try {
    await sendSmsOtp(phoneNumber, otp, lang ?? "en");
    req.log.info({ phoneNumber }, "OTP sent via SMS");
  } catch (err: any) {
    req.log.error({ phoneNumber, err: err?.message }, "Failed to send OTP via SMS");
    const errMsg = lang === "rw"
      ? "Ntabwo byashobotse kohereza ubutumwa bwa SMS. Ongera ugerageze."
      : "Could not send verification SMS. Please try again.";
    res.status(502).json({ error: "sms_failed", message: errMsg });
    return;
  }

  res.json({ message: "OTP sent successfully", expiresInSeconds: 600 });
});

// POST /auth/verify-otp
router.post("/auth/verify-otp", async (req, res) => {
  const { phoneNumber, otp, inviteCode, lang } = req.body as {
    phoneNumber?: string;
    otp?: string;
    inviteCode?: string;
    lang?: "en" | "rw";
  };
  if (!phoneNumber || !otp) {
    res.status(400).json({ error: "bad_request", message: "phoneNumber and otp are required" });
    return;
  }

  const now = new Date();

  // Dev bypass: 123456 always works when AT credentials are not configured
  const atConfigured = !!process.env["AT_USERNAME"] && !!process.env["AT_API_KEY"];
  const isDevBypass  = !atConfigured && otp === "123456";

  if (!isDevBypass) {
    const session = await db
      .select()
      .from(otpSessionsTable)
      .where(
        and(
          eq(otpSessionsTable.phoneNumber, phoneNumber),
          eq(otpSessionsTable.code, otp),
          gt(otpSessionsTable.expiresAt, now),
          isNull(otpSessionsTable.usedAt),
        ),
      )
      .limit(1);

    if (session.length === 0) {
      res.status(401).json({ error: "invalid_otp", message: "Invalid or expired OTP" });
      return;
    }

    await db
      .update(otpSessionsTable)
      .set({ usedAt: now })
      .where(eq(otpSessionsTable.id, session[0]!.id));
  }

  // Clean up old expired sessions
  await db
    .delete(otpSessionsTable)
    .where(lt(otpSessionsTable.expiresAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));

  // Find or create profile
  let profile = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.phoneNumber, phoneNumber))
    .limit(1);

  let isNewUser = false;

  if (profile.length === 0) {
    const myInviteCode = generateInviteCode();
    let invitedByProfile: string | null = null;
    let isVerified = false;
    let verificationMethod: "invite" | null = null;
    let inviterUser: typeof profilesTable.$inferSelect | null = null;

    if (inviteCode && typeof inviteCode === "string" && inviteCode.trim()) {
      const inviter = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.inviteCode, inviteCode.trim().toUpperCase()))
        .limit(1);
      if (inviter[0]) {
        inviterUser = inviter[0];
        invitedByProfile = inviter[0].id;
        isVerified = true;
        verificationMethod = "invite";
      }
    }

    const [created] = await db
      .insert(profilesTable)
      .values({
        phoneNumber,
        phoneVerified: true,
        inviteCode: isVerified ? myInviteCode : null,
        invitedByProfile,
        isVerified,
        verificationMethod,
        trustScore: isVerified ? 65 : 50,
        language: lang === "rw" ? "rw" : "en",
      } as any)
      .returning();

    profile = [created!];
    isNewUser = true;

    if (inviterUser && invitedByProfile) {
      await db
        .update(profilesTable)
        .set({
          inviteCount: (inviterUser.inviteCount ?? 0) + 1,
          trustScore: Math.min(100, (inviterUser.trustScore ?? 50) + 10),
        } as any)
        .where(eq(profilesTable.id, invitedByProfile));

      await db.insert(invitesTable).values({
        inviterId: invitedByProfile,
        invitedUserId: created!.id,
        inviteCode: inviteCode!.trim().toUpperCase(),
        status: "accepted",
        acceptedAt: new Date(),
      });

      await db.insert(trustEventsTable).values([
        {
          userId: created!.id,
          eventType: "invited_by_member",
          delta: 15 as any,
          sourceId: invitedByProfile,
        },
        {
          userId: invitedByProfile,
          eventType: "successful_invite",
          delta: 10 as any,
          sourceId: created!.id,
        },
      ]);
    }
  } else {
    const updateValues: Record<string, unknown> = {
      phoneVerified: true,
      lastActive: new Date(),
    };
    if (!profile[0]!.inviteCode && profile[0]!.isVerified && profile[0]!.accountStatus === "active") {
      updateValues["inviteCode"] = generateInviteCode();
    }
    await db
      .update(profilesTable)
      .set(updateValues as any)
      .where(eq(profilesTable.id, profile[0]!.id));
  }

  const token = signToken({ userId: profile[0]!.id });

  res.json({
    token,
    userId: profile[0]!.id,
    isNewUser,
    onboardingComplete: profile[0]!.onboardingComplete ?? false,
    isVerified: profile[0]!.isVerified ?? false,
  });
});

export default router;
