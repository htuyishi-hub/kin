import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { signToken } from "../lib/jwt.js";

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
  const { accessToken } = req.body as { accessToken?: string };
  if (!accessToken || typeof accessToken !== "string") {
    res.status(400).json({ error: "bad_request", message: "accessToken is required" });
    return;
  }

  let userInfo: Auth0UserInfo;
  try {
    userInfo = await getUserInfo(accessToken);
  } catch (err: any) {
    req.log.warn({ err: err?.message }, "Auth0 token verification failed");
    res.status(401).json({ error: "invalid_token", message: "Auth0 verification failed" });
    return;
  }

  // Look up by auth0 sub (stored in googleId) or email
  const conditions = userInfo.email
    ? or(eq(profilesTable.googleId, userInfo.sub), eq(profilesTable.email, userInfo.email))
    : eq(profilesTable.googleId, userInfo.sub);

  // Keep the initial lookup minimal to avoid runtime column-mapping issues
  // (your DB error is happening during this query).
  const existing = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(conditions)
    .limit(1);

  let isNewUser = false;
  let profileId = existing[0]?.id;

  if (!profileId) {
    const [created] = await db
      .insert(profilesTable)
      .values({
        phoneNumber: `auth0:${userInfo.sub}`,
        googleId: userInfo.sub,
        email: userInfo.email ?? null,
        fullName: userInfo.name ?? null,
        phoneVerified: false,
        // Ensure any NOT NULL columns have values via schema defaults
        // (Drizzle will omit fields that have defaults).
      })
      .returning({ id: profilesTable.id });

    profileId = created!.id;
    isNewUser = true;
  } else {
    // Update lastActive/email/googleId opportunistically.
    await db
      .update(profilesTable)
      .set({
        googleId: userInfo.sub,
        email: userInfo.email ?? null,
        lastActive: new Date(),
      })
      .where(eq(profilesTable.id, profileId));
  }

  // Fetch only the fields we actually return to the app.
  const profile = await db
    .select({
      onboardingComplete: profilesTable.onboardingComplete,
      id: profilesTable.id,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId))
    .limit(1);

  const onboardingComplete = profile[0]?.onboardingComplete ?? false;


  const token = signToken({ userId: profile.id });

  res.json({
    token,
    userId:             profile.id,
    isNewUser,
    onboardingComplete: profile.onboardingComplete ?? false,
  });
});

export default router;
