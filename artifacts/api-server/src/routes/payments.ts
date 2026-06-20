import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, paymentsTable, profilesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

const PRODUCT_PRICES: Record<string, number> = {
  tokens_3: 1000,
  crossing_fee: 2500,
  profile_boost: 500,
  second_chance: 100,
  professional_monthly: 2000,
};

// GET /payments
router.get("/payments", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, userId));

  res.json(payments.map((p) => ({
    id: p.id,
    productType: p.productType,
    amountRwf: p.amountRwf,
    status: p.status,
    fulfilled: p.fulfilled ?? false,
    createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
  })));
});

// POST /payments/initiate — MVP sandbox: auto-fulfill
router.post("/payments/initiate", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { productType, phoneNumber } = req.body as {
    productType?: string;
    phoneNumber?: string;
  };

  if (!productType || !PRODUCT_PRICES[productType]) {
    res.status(400).json({ error: "bad_request", message: "Invalid productType" });
    return;
  }

  const amountRwf = PRODUCT_PRICES[productType]!;

  // MVP sandbox: auto-complete payment immediately
  const [payment] = await db
    .insert(paymentsTable)
    .values({
      userId,
      productType,
      amountRwf,
      status: "completed",
      fulfilled: true,
      completedAt: new Date(),
    })
    .returning();

  // Fulfill product
  if (productType === "tokens_3") {
    const profile = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    const current = profile[0]?.tokensRemaining ?? 0;
    await db
      .update(profilesTable)
      .set({ tokensRemaining: (current + 3) as any })
      .where(eq(profilesTable.id, userId));
  } else if (productType === "crossing_fee") {
    await db
      .update(profilesTable)
      .set({ crossingFeePaid: true })
      .where(eq(profilesTable.id, userId));
  }

  res.json({
    id: payment!.id,
    productType: payment!.productType,
    amountRwf: payment!.amountRwf,
    status: payment!.status,
    fulfilled: payment!.fulfilled ?? false,
    createdAt: payment!.createdAt?.toISOString() ?? new Date().toISOString(),
    completedAt: payment!.completedAt?.toISOString() ?? null,
  });
});

export default router;
