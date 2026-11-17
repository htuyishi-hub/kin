import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { signToken } from "../lib/jwt.js";
import { generateInviteCode } from "../lib/inviteCode.js";

const router = Router();

interface Auth0UserInfo {
  sub:            string;
  email?:         string;
  email_verified?: boolean;
  name?:          string;
  picture?:       string;
}

async function getUserInfo(accessToken: string): Promise<Auth0UserInfo> {
  const domain = process.env["AUTH0_DOMAIN"];
  if (!domain) throw new Error("AUTH0_DOMAIN not configured");

  const res = await fetch(`https://${domain}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Auth0 userinfo failed: ${res.status}`);

  const data = await res.json() as any;
  if (!data.sub) throw new Error("Invalid Auth0 userinfo response");

  return {
    sub:            data.sub,
    email:          data.email,
    email_verified: data.email_verified,
    name:           data.name,
    picture:        data.picture,
  };
}

// POST /auth/auth0
// Body: { accessToken: string }
router.post("/auth/auth0", async (req, res) => {
  const t0 = Date.now();
  const requestId = req.id;

  try {
    // Step 1: Validate request
    const stepT = Date.now();
    const { accessToken } = req.body as { accessToken?: string };
    if (!accessToken || typeof accessToken !== "string") {
      req.log.info({ requestId, durationMs: Date.now() - stepT, step: "validate_request", ok: false }, "Invalid accessToken");
      res.status(400).json({ error: "bad_request", message: "accessToken is required" });
      return;
    }
    req.log.info({ requestId, durationMs: Date.now() - stepT, step: "validate_request", ok: true }, "Validated request");

    // Step 2: Auth0 userinfo
    const authT = Date.now();
    let userInfo: Auth0UserInfo;
    try {
      userInfo = await getUserInfo(accessToken);
    } catch (err: any) {
      req.log.error(
        { requestId, durationMs: Date.now() - authT, step: "auth0_userinfo", err },
        "Auth0 userinfo failed"
      );
      res.status(401).json({ error: "invalid_token", message: "Auth0 verification failed" });
      return;
    }
    req.log.info(
      {
        requestId,
        durationMs: Date.now() - authT,
        step: "auth0_userinfo",
        provider: userInfo.sub?.split("|")?.[0],
        hasEmail: Boolean(userInfo.email),
        sub: userInfo.sub,
      },
      "Auth0 userinfo ok"
    );

    // Step 3: Build query conditions
    const condT = Date.now();
    const conditions = userInfo.email
      ? or(eq(profilesTable.googleId, userInfo.sub), eq(profilesTable.email, userInfo.email))
      : eq(profilesTable.googleId, userInfo.sub);
    req.log.info({ requestId, durationMs: Date.now() - condT, step: "build_conditions" }, "Built conditions");

    // Step 4: SELECT profile
    const selectT = Date.now();
    const existing = await db
      .select()
      .from(profilesTable)
      .where(conditions)
      .limit(1);
    req.log.info(
      { requestId, durationMs: Date.now() - selectT, step: "select_profile", found: existing.length > 0 },
      "SELECT profile"
    );

    // Step 5: Process results (INSERT or UPDATE)
    let isNewUser = false;
    let profile = existing[0];

    if (!profile) {
      const insertT = Date.now();
      const myInviteCode = generateInviteCode();
      const [created] = await db
        .insert(profilesTable)
        .values({
          phoneNumber: `auth0:${userInfo.sub}`,
          googleId: userInfo.sub,
          email: userInfo.email ?? null,
          fullName: userInfo.name ?? null,
          inviteCode: myInviteCode,
          inviteCount: 0,
          isVerified: false,
          phoneVerified: false,
          idVerified: false,
          vouchCount: 0,
          trustScore: 0,
          tokensRemaining: 0,
          profileActive: true,
          profilePaused: false,
          onboardingComplete: false,
        } as any)
        .returning();

      profile = created;
      isNewUser = true;
      req.log.info(
        { requestId, durationMs: Date.now() - insertT, step: "insert_profile", isNewUser: true },
        "INSERT new profile"
      );
    } else {
      const updateT = Date.now();
      const updates: Record<string, unknown> = {
        googleId: userInfo.sub,
        email: userInfo.email ?? null,
        lastActive: new Date(),
      };
      if (!profile.inviteCode) {
        updates["inviteCode"] = generateInviteCode();
      }
      await db
        .update(profilesTable)
        .set(updates as any)
        .where(eq(profilesTable.id, profile.id));

      req.log.info(
        { requestId, durationMs: Date.now() - updateT, step: "update_profile", isNewUser: false },
        "UPDATE profile"
      );

      const fetchT = Date.now();
      const [updated] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, profile.id))
        .limit(1);

      profile = updated || profile;
      req.log.info(
        { requestId, durationMs: Date.now() - fetchT, step: "select_updated_profile" },
        "SELECT updated profile"
      );
    }

    // Step 6: Generate JWT
    const jwtT = Date.now();
    const token = signToken({ userId: profile.id });
    req.log.info({ requestId, durationMs: Date.now() - jwtT, step: "generate_jwt" }, "JWT generated");

    // Step 7: Send response
    res.json({
      token,
      userId: profile.id,
      isNewUser,
      onboardingComplete: profile.onboardingComplete ?? false,
    });

    req.log.info(
      { requestId, durationMs: Date.now() - t0, step: "send_response", ok: true, isNewUser },
      "Auth0 login completed"
    );
  } catch (err) {
    req.log.error({ requestId, durationMs: Date.now() - t0, err }, "Unhandled /auth/auth0 error");
    res.status(500).json({ error: "authentication_failed" });
  }
});


export default router;
