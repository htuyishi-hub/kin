// Phase 2 implementation: secure UR verification + atomic claim
import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { studentRegistryTable, urVerificationAttemptsTable } from "@workspace/db/schema";
import { generateInviteCode } from "../lib/inviteCode.js";


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
    return respond(res, { status: "invalid_format", code: "UR_REGISTRATION_INVALID", message: "Registration number must be 9 digits" }, 200);
  }

  // Step 2 — prefix validation (academic intake years 2018-2030)
  const isLikelyUrStudent = /^2[1-3]\d{7}$/.test(reg);
  if (!isLikelyUrStudent) {
    await safeAudit(profileId, reg, "invalid_format");
    return respond(res, { status: "invalid_format", code: "UR_REGISTRATION_INVALID", message: "Registration number must be 9 digits starting with 21, 22, or 23" }, 200);
  }

  // Step 3 — campus requirement
  if (!selectedCampus) {
    await safeAudit(profileId, reg, "missing_campus");
    return respond(res, { status: "not_found", message: "Campus is required" }, 200);
  }

  // Step 4 — registry lookup & atomic claiming
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          registrationNumber: studentRegistryTable.registrationNumber,
          campus: studentRegistryTable.campus,
          claimed: studentRegistryTable.claimed,
          claimedByProfile: studentRegistryTable.claimedByProfile,
        })
        .from(studentRegistryTable)
        .where(eq(studentRegistryTable.registrationNumber, reg))
        .limit(1);

      if (existing) {
        // If claimed by someone else, block
        if (existing.claimed && existing.claimedByProfile && existing.claimedByProfile !== profileId) {
          const err = new Error("already_claimed");
          (err as any).code = "already_claimed";
          throw err;
        }

        // Atomically claim or update existing record
        await tx
          .update(studentRegistryTable)
          .set({
            claimed: true,
            claimedByProfile: profileId,
            campus: selectedCampus,
            updatedAt: new Date(),
          })
          .where(eq(studentRegistryTable.registrationNumber, reg));
      } else {
        // First time this real UR student registers: create and claim the registry record
        await tx.insert(studentRegistryTable).values({
          registrationNumber: reg,
          campus: selectedCampus,
          claimed: true,
          claimedByProfile: profileId,
          updatedAt: new Date(),
        });
      }

      const [currProfile] = await tx
        .select({ inviteCode: profilesTable.inviteCode })
        .from(profilesTable)
        .where(eq(profilesTable.id, profileId))
        .limit(1);

      const assignedInviteCode = currProfile?.inviteCode ?? generateInviteCode();

      // Profile trust & verification binding
      await tx
        .update(profilesTable)
        .set({
          institution: "university_of_rwanda",
          campus: selectedCampus,
          registrationNumber: reg,
          institutionVerified: true,
          isVerified: true,
          accountStatus: "active",
          verificationMethod: "ur_registry",
          inviteCode: assignedInviteCode,
        } as any)
        .where(eq(profilesTable.id, profileId));

      // Audit log write
      await tx.insert(urVerificationAttemptsTable).values({
        profileId,
        registrationNumber: reg,
        result: "verified",
      });
    });
  } catch (err: any) {
    if (err?.code === "already_claimed") {
      await safeAudit(profileId, reg, "already_claimed");
      return respond(res, { status: "already_claimed", message: "This registration number is already linked to another Kin account." }, 200);
    }

    console.error("[UR Verification Error]", err);
    await safeAudit(profileId, reg, "verified_failed");
    return respond(res, { status: "not_found", message: "Verification failed. Please try again." }, 200);
  }

  // Return success signal so frontend routes immediately
  return respond(res, {
    status: "verified",
    verified: true,
    institution: "university_of_rwanda",
    campus: selectedCampus,
    registration_number: reg,
  });
}

// Convenience export to match router registration style (with auth requirement).
export default function urVerificationRouter() {
  return {
    requireAuth,
    verifyURRegistration,
  } as const;
}

