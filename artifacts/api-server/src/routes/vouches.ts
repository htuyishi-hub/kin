import { Router } from "express";
import { eq, and, sql, asc } from "drizzle-orm";
import { db, vouchesTable, profilesTable, profilePhotosTable, trustEventsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { verifyToken } from "../lib/jwt.js";

const router = Router();

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function mapVouch(v: typeof vouchesTable.$inferSelect & {
  voucherName?: string | null;
  vouchedName?: string | null;
}) {
  return {
    id: v.id,
    vouchedUserId: v.vouchedUser,
    voucherUserId: v.voucher,
    voucherName: v.voucherName ?? null,
    vouchedName: v.vouchedName ?? null,
    status: v.status,
    createdAt: v.createdAt?.toISOString() ?? new Date().toISOString(),
    confirmedAt: v.confirmedAt?.toISOString() ?? null,
  };
}

async function refreshVouchCount(userId: string) {
  const confirmed = await db
    .select({ count: sql<number>`count(*)` })
    .from(vouchesTable)
    .where(and(eq(vouchesTable.vouchedUser, userId), eq(vouchesTable.status, "confirmed")));
  const count = Number(confirmed[0]?.count ?? 0);
  await db.update(profilesTable).set({ vouchCount: count as any }).where(eq(profilesTable.id, userId));
}

// GET /vouches/teaser/:userId — Teaser profile strictly limited to 2 images & basic demographics
router.get("/vouches/teaser/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ error: "bad_request", message: "userId parameter is required" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "not_found", message: "User profile not found" });
    return;
  }

  // Strictly limited to 2 photos as per spec
  const photos = await db
    .select()
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, userId))
    .orderBy(asc(profilePhotosTable.sortOrder))
    .limit(2);

  // Optional authenticated viewer context
  let viewerId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(authHeader.slice(7));
      viewerId = payload.userId;
    } catch {
      // Viewer is not logged in or invalid token
    }
  }

  let alreadyVouched = false;
  let isSelf = false;
  if (viewerId) {
    if (viewerId === userId) {
      isSelf = true;
    } else {
      const existing = await db
        .select()
        .from(vouchesTable)
        .where(and(eq(vouchesTable.vouchedUser, userId), eq(vouchesTable.voucher, viewerId)))
        .limit(1);

      if (existing[0]?.status === "confirmed") {
        alreadyVouched = true;
      }
    }
  }

  res.json({
    id: profile.id,
    fullName: profile.fullName ?? "Kin Member",
    firstName: profile.fullName ? profile.fullName.trim().split(" ")[0] : "Member",
    gender: profile.gender ?? null,
    age: profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : null,
    campusName: profile.campusName ?? null,
    faculty: profile.faculty ?? null,
    yearOfStudy: profile.yearOfStudy ?? null,
    city: profile.city ?? null,
    district: profile.district ?? null,
    primaryIntent: profile.primaryIntent ?? null,
    accountStatus: profile.accountStatus ?? "waitlisted",
    isVerified: Boolean(profile.isVerified || profile.institutionVerified),
    vouchCount: profile.vouchCount ?? 0,
    photos: photos.map((p) => ({
      id: p.id,
      publicUrl: p.publicUrl,
      isPrimary: p.isPrimary,
    })),
    alreadyVouched,
    isSelf,
  });
});

// POST /vouches/execute — High-friction public approval execution (enforces Quorum & Anti-Farming)
router.post("/vouches/execute", requireAuth, async (req, res) => {
  const voucherId = (req as AuthedRequest).userId;
  const { voucheeId } = req.body as { voucheeId?: string };

  if (!voucheeId) {
    res.status(400).json({ error: "bad_request", message: "voucheeId is required" });
    return;
  }

  // Guard 1: Prevent self-approval
  if (voucherId === voucheeId) {
    res.status(400).json({ error: "bad_request", message: "You cannot approve yourself" });
    return;
  }

  // Guard 2: Verify approver profile & standing
  const [voucher] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, voucherId))
    .limit(1);

  if (!voucher) {
    res.status(404).json({ error: "not_found", message: "Approver profile not found" });
    return;
  }

  const voucherIsActive = voucher.profileActive !== false && voucher.accountStatus === "active";
  const voucherIsVerified = Boolean(voucher.isVerified || voucher.institutionVerified);

  if (!voucherIsActive || !voucherIsVerified) {
    res.status(403).json({
      error: "forbidden",
      message: "Only verified, active members in good standing can approve other candidates.",
    });
    return;
  }

  // Guard 3: Minimum Trust Score 10
  const approverTrust = voucher.trustScore ?? 1;
  if (approverTrust < 10) {
    res.status(403).json({
      error: "forbidden",
      message: `Minimum Trust Score of 10 required to approve candidates (your score: ${approverTrust}).`,
    });
    return;
  }

  // Guard 4: Velocity Limit — max 5 approvals per 24 hours & 10s cooldown
  const recentApprovals = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      lastConfirmedAt: sql<string>`max(${vouchesTable.confirmedAt})`,
    })
    .from(vouchesTable)
    .where(
      and(
        eq(vouchesTable.voucher, voucherId),
        sql`${vouchesTable.confirmedAt} > now() - interval '24 hours'`
      )
    );

  const dailyCount = recentApprovals[0]?.count ?? 0;
  if (dailyCount >= 5) {
    res.status(429).json({
      error: "too_many_requests",
      message: "Daily approval limit reached (5 approvals/24h). Please wait before approving more candidates.",
    });
    return;
  }

  const lastConfirmedAtStr = recentApprovals[0]?.lastConfirmedAt;
  if (lastConfirmedAtStr) {
    const elapsedMs = Date.now() - new Date(lastConfirmedAtStr).getTime();
    if (elapsedMs < 10000) {
      res.status(429).json({
        error: "too_many_requests",
        message: "Approval velocity too high. Please review candidate profiles carefully.",
      });
      return;
    }
  }

  // Guard 5: Verify candidate profile exists
  const [vouchee] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, voucheeId))
    .limit(1);

  if (!vouchee) {
    res.status(404).json({ error: "not_found", message: "Candidate profile not found" });
    return;
  }

  if (vouchee.accountStatus === "active") {
    res.json({
      success: true,
      message: `${vouchee.fullName || "This candidate"} is already active on Kin.`,
      activated: true,
      voucheeId,
      voucherId,
    });
    return;
  }

  // Non-linear bounded weight (capped at max 3 points)
  const weight = approverTrust >= 80 ? 3 : approverTrust >= 40 ? 2 : 1;
  const MIN_DISTINCT_APPROVERS = 2;
  const MIN_APPROVAL_SCORE = 5;
  let activated = false;
  let distinctApprovers = 0;
  let newApprovalScore = 0;
  let vouchId = "";

  // Execute atomic transaction: upsert approval + update score + check multi-sig quorum
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(vouchesTable)
      .where(and(eq(vouchesTable.vouchedUser, voucheeId), eq(vouchesTable.voucher, voucherId)))
      .limit(1);

    if (existing[0]) {
      vouchId = existing[0].id;
      await tx
        .update(vouchesTable)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(vouchesTable.id, existing[0].id));
    } else {
      const [inserted] = await tx
        .insert(vouchesTable)
        .values({
          vouchedUser: voucheeId,
          voucher: voucherId,
          status: "confirmed",
          confirmedAt: new Date(),
        })
        .returning({ id: vouchesTable.id });
      vouchId = inserted?.id ?? "";
    }

    // Add approver bounded weight to candidate approval_score
    const [updatedCandidate] = await tx
      .update(profilesTable)
      .set({
        approvalScore: sql`COALESCE(${profilesTable.approvalScore}, 0) + ${weight}`,
        vouchCount: sql`COALESCE(${profilesTable.vouchCount}, 0) + 1`,
      })
      .where(eq(profilesTable.id, voucheeId))
      .returning({ approvalScore: profilesTable.approvalScore });

    newApprovalScore = updatedCandidate?.approvalScore ?? 0;

    // Count distinct confirmed approvers (QUORUM REQUIREMENT)
    const [{ count }] = await tx
      .select({ count: sql<number>`count(DISTINCT ${vouchesTable.voucher})`.mapWith(Number) })
      .from(vouchesTable)
      .where(and(eq(vouchesTable.vouchedUser, voucheeId), eq(vouchesTable.status, "confirmed")));

    distinctApprovers = count;

    // Multi-sig Quorum: Requires at least 2 distinct approvers AND approval_score >= 5
    if (distinctApprovers >= MIN_DISTINCT_APPROVERS && newApprovalScore >= MIN_APPROVAL_SCORE) {
      await tx
        .update(profilesTable)
        .set({
          accountStatus: "active",
          isVerified: true,
          profileActive: true,
        })
        .where(eq(profilesTable.id, voucheeId));
      activated = true;
    }

    // Audit log trust event for the approver (+2 delta)
    await tx.insert(trustEventsTable).values({
      userId: voucherId,
      eventType: "approved_candidate",
      delta: 2,
      sourceId: voucheeId,
    });
  });

  res.json({
    success: true,
    message: activated
      ? `You have approved ${vouchee.fullName || "this candidate"}. They have reached community quorum and are now an active member!`
      : `You have approved ${vouchee.fullName || "this candidate"} (+${weight} weight). They need ${Math.max(
          0,
          MIN_DISTINCT_APPROVERS - distinctApprovers
        )} more independent approval to activate.`,
    vouchId,
    voucheeId,
    voucherId,
    weightAdded: weight,
    newApprovalScore,
    distinctApprovers,
    minApproversNeeded: MIN_DISTINCT_APPROVERS,
    activated,
  });
});

// POST /vouches/request (legacy by phone number)
router.post("/vouches/request", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { voucherPhoneNumber } = req.body as { voucherPhoneNumber?: string };

  if (!voucherPhoneNumber) {
    res.status(400).json({ error: "bad_request", message: "voucherPhoneNumber is required" });
    return;
  }

  const voucher = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.phoneNumber, voucherPhoneNumber))
    .limit(1);

  if (voucher.length === 0) {
    res.status(400).json({ error: "not_found", message: "No user with that phone number found" });
    return;
  }

  if (voucher[0]!.id === userId) {
    res.status(400).json({ error: "bad_request", message: "You cannot vouch for yourself" });
    return;
  }

  const existing = await db
    .select()
    .from(vouchesTable)
    .where(and(eq(vouchesTable.vouchedUser, userId), eq(vouchesTable.voucher, voucher[0]!.id)))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "duplicate", message: "Vouch request already exists" });
    return;
  }

  const [vouch] = await db
    .insert(vouchesTable)
    .values({ vouchedUser: userId, voucher: voucher[0]!.id })
    .returning();

  res.status(201).json(mapVouch({
    ...vouch!,
    voucherName: voucher[0]!.fullName ?? null,
    vouchedName: null,
  }));
});

// GET /vouches/incoming
router.get("/vouches/incoming", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const vouches = await db
    .select({
      vouch: vouchesTable,
      vouchedName: profilesTable.fullName,
    })
    .from(vouchesTable)
    .innerJoin(profilesTable, eq(vouchesTable.vouchedUser, profilesTable.id))
    .where(and(eq(vouchesTable.voucher, userId), eq(vouchesTable.status, "pending")));

  res.json(vouches.map((v) => mapVouch({
    ...v.vouch,
    voucherName: null,
    vouchedName: v.vouchedName ?? null,
  })));
});

// GET /vouches/outgoing
router.get("/vouches/outgoing", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const vouches = await db
    .select({
      vouch: vouchesTable,
      voucherName: profilesTable.fullName,
    })
    .from(vouchesTable)
    .innerJoin(profilesTable, eq(vouchesTable.voucher, profilesTable.id))
    .where(eq(vouchesTable.vouchedUser, userId));

  res.json(vouches.map((v) => mapVouch({
    ...v.vouch,
    voucherName: v.voucherName ?? null,
    vouchedName: null,
  })));
});

// POST /vouches/:vouchId/confirm
router.post("/vouches/:vouchId/confirm", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { vouchId } = req.params;

  const [updated] = await db
    .update(vouchesTable)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(and(eq(vouchesTable.id, String(vouchId)), eq(vouchesTable.voucher, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Vouch not found or not yours to confirm" });
    return;
  }

  await refreshVouchCount(updated.vouchedUser);
  res.json(mapVouch(updated));
});

// POST /vouches/:vouchId/decline
router.post("/vouches/:vouchId/decline", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { vouchId } = req.params;

  const [updated] = await db
    .update(vouchesTable)
    .set({ status: "revoked" })
    .where(and(eq(vouchesTable.id, String(vouchId)), eq(vouchesTable.voucher, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Vouch not found" });
    return;
  }

  res.json(mapVouch(updated));
});

export default router;
