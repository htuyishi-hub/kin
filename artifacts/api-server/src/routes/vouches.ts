import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, vouchesTable, profilesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { sql } from "drizzle-orm";

const router = Router();

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

// POST /vouches/request
router.post("/vouches/request", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { voucherPhoneNumber } = req.body as { voucherPhoneNumber?: string };

  if (!voucherPhoneNumber) {
    res.status(400).json({ error: "bad_request", message: "voucherPhoneNumber is required" });
    return;
  }

  // Find voucher by phone
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

  // Check for duplicate
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
