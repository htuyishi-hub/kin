import { Router } from "express";
import { eq, and, gt, isNull, lt } from "drizzle-orm";
import { randomInt } from "crypto";
import { db, otpSessionsTable, profilesTable } from "@workspace/db";
import { signToken } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";

const router = Router();

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

async function sendSmsOtp(phoneNumber: string, otp: string): Promise<void> {
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

  await sms.send({
    to:      [phoneNumber],
    message: `Your Kin verification code is ${otp}. It expires in 10 minutes. Do not share it.`,
    from:    senderId,
  });
}

// POST /auth/send-otp
router.post("/auth/send-otp", async (req, res) => {
  const { phoneNumber } = req.body as { phoneNumber?: string };
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
    await sendSmsOtp(phoneNumber, otp);
    req.log.info({ phoneNumber }, "OTP sent via SMS");
  } catch (err: any) {
    req.log.error({ phoneNumber, err: err?.message }, "Failed to send OTP via SMS");
    res.status(502).json({ error: "sms_failed", message: "Could not send verification SMS. Please try again." });
    return;
  }

  res.json({ message: "OTP sent successfully", expiresInSeconds: 600 });
});

// POST /auth/verify-otp
router.post("/auth/verify-otp", async (req, res) => {
  const { phoneNumber, otp } = req.body as { phoneNumber?: string; otp?: string };
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
    const [created] = await db
      .insert(profilesTable)
      .values({ phoneNumber, phoneVerified: true })
      .returning();
    profile = [created!];
    isNewUser = true;
  } else {
    await db
      .update(profilesTable)
      .set({ phoneVerified: true, lastActive: new Date() })
      .where(eq(profilesTable.id, profile[0]!.id));
  }

  const token = signToken({ userId: profile[0]!.id });

  res.json({
    token,
    userId: profile[0]!.id,
    isNewUser,
    onboardingComplete: profile[0]!.onboardingComplete ?? false,
  });
});

export default router;
