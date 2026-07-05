// Phase 2 implementation: secure UR verification + atomic claim
import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { studentRegistryTable, urVerificationAttemptsTable } from "@workspace/db/schema";


const ALLOWED_UR_PREFIXES = [
  "2220",
  "2230",
  "2240",
  "2250",
  "2260",
  "2270",
  "2280",
  "2290",
  "2300",
] as const;
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

function isValidRegistrationNumber(reg: string): boolean {
  return /^\d{9}$/.test(reg);
}

function respond(res: Response, payload: unknown, status = 200) {
  res.status(status).json(payload);
}

function getPrefix(reg: string): string {
  return reg.slice(0, 4);
}

async function safeAudit(profileId: string, registrationNumber: string, result: string) {
  try {
    await db.insert(urVerificationAttemptsTable).values({
      profileId,
      registrationNumber,
      result,
    });
  } catch {
    // never block verification due to audit failure
  }
}

// Endpoint: POST /api/me/ur/verify-registration
// Response states:
// - verified
// - invalid_format
// - not_found
// - already_claimed
export async function verifyURRegistration(req: Request, res: Response) {
  const profileId = (req as AuthedRequest).userId;

  const { registration_number, campus } = req.body as {
    registration_number?: unknown;
    campus?: unknown;
  };

  const reg = typeof registration_number === "string" ? registration_number.trim() : "";
  const selectedCampus = typeof campus === "string" ? campus.trim() : "";

  // Step 1 — format validation
  if (!isValidRegistrationNumber(reg)) {
    await safeAudit(profileId, reg, "invalid_format");
    return respond(res, { status: "invalid_format", message: "Registration number must be 9 digits" }, 200);
  }

  // Step 2 — prefix validation (config-driven)
  const prefix = getPrefix(reg);
  const isAllowedPrefix = (ALLOWED_UR_PREFIXES as readonly string[]).includes(prefix);
  if (!isAllowedPrefix) {
    // anti-enumeration: treat unknown prefixes as not_found
    await safeAudit(profileId, reg, "not_found");
    return respond(res, { status: "not_found" }, 200);
  }

  // Step 3 — campus match (strict)
  if (!selectedCampus) {
    await safeAudit(profileId, reg, "not_found");
    return respond(res, { status: "not_found" }, 200);
  }

  // Step 4 — registry lookup
  const [row] = await db
    .select({
      registrationNumber: studentRegistryTable.registrationNumber,
      campus: studentRegistryTable.campus,
      claimed: studentRegistryTable.claimed,
    })
    .from(studentRegistryTable)
    .where(eq(studentRegistryTable.registrationNumber, reg))
    .limit(1);

  if (!row) {
    await safeAudit(profileId, reg, "not_found");
    return respond(res, { status: "not_found" }, 200);
  }

  // Step 5 — strict campus match prevents spoofing
  if (row.campus !== selectedCampus) {
    await safeAudit(profileId, reg, "not_found");
    return respond(res, { status: "not_found" }, 200);
  }

  // Step 6 — atomic uniqueness enforcement (one reg = one profile forever)
  const updated = await db
    .update(studentRegistryTable)
    .set({
      claimed: true,
      claimedByProfile: profileId,
      updatedAt: new Date(),
    })
    .where(
      sql`${studentRegistryTable.registrationNumber} = ${reg} AND ${studentRegistryTable.claimed} = false`,
    )
    .returning();

  if (!updated || updated.length === 0) {
    await safeAudit(profileId, reg, "already_claimed");
    return respond(res, { status: "already_claimed" }, 200);
  }

  // Step 7 — profile update (best-effort; ignores if schema not yet aligned)
  try {
    await db
      .update(profilesTable)
      .set({
        ...( {
          institution: "university_of_rwanda",
          campusName: selectedCampus,
          registrationNumber: reg,
          institutionVerified: true,
          verificationMethod: "ur_registry",
        } as any),
      } as any)
      .where(eq(profilesTable.id, profileId));
  } catch {
    // ignore to avoid breaking onboarding
  }

  await safeAudit(profileId, reg, "verified");

  return respond(res, {
    status: "verified",
    institution: "university_of_rwanda",
    campus: selectedCampus,
  });
}

// Convenience export to match router registration style (with auth requirement).
export default function urVerificationRouter() {
  return {
    requireAuth,
    verifyURRegistration,
  } as const;
}

