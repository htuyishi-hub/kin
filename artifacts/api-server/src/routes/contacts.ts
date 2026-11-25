import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, blockedContactsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

export function normalizeRwandaPhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+250") && cleaned.length >= 12) {
    return "0" + cleaned.slice(4);
  }
  if (cleaned.startsWith("250") && cleaned.length >= 12) {
    return "0" + cleaned.slice(3);
  }
  return cleaned;
}

// GET /contacts/blocked — List blocked phone numbers for current user
router.get("/contacts/blocked", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select({
      id: blockedContactsTable.id,
      blockedPhone: blockedContactsTable.blockedPhone,
      createdAt: blockedContactsTable.createdAt,
    })
    .from(blockedContactsTable)
    .where(eq(blockedContactsTable.userId, userId))
    .orderBy(desc(blockedContactsTable.createdAt));

  res.json({ contacts: rows });
});

// POST /contacts/block — Block one or more phone numbers
router.post("/contacts/block", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { phoneNumber, phoneNumbers } = req.body as {
    phoneNumber?: string;
    phoneNumbers?: string[];
  };

  const rawList: string[] = [];
  if (typeof phoneNumber === "string") rawList.push(phoneNumber);
  if (Array.isArray(phoneNumbers)) {
    for (const p of phoneNumbers) {
      if (typeof p === "string") rawList.push(p);
    }
  }

  const normalized = Array.from(
    new Set(rawList.map(normalizeRwandaPhone).filter((p) => p.length >= 6))
  );

  if (normalized.length === 0) {
    res.status(400).json({ error: "invalid_phone", message: "Valid phone number required" });
    return;
  }

  const existing = await db
    .select({ blockedPhone: blockedContactsTable.blockedPhone })
    .from(blockedContactsTable)
    .where(eq(blockedContactsTable.userId, userId));

  const existingSet = new Set(existing.map((e) => e.blockedPhone));
  const toInsert = normalized.filter((p) => !existingSet.has(p));

  if (toInsert.length > 0) {
    await db.insert(blockedContactsTable).values(
      toInsert.map((blockedPhone) => ({
        userId,
        blockedPhone,
      }))
    );
  }

  const updated = await db
    .select({
      id: blockedContactsTable.id,
      blockedPhone: blockedContactsTable.blockedPhone,
      createdAt: blockedContactsTable.createdAt,
    })
    .from(blockedContactsTable)
    .where(eq(blockedContactsTable.userId, userId))
    .orderBy(desc(blockedContactsTable.createdAt));

  res.json({ contacts: updated });
});

// DELETE /contacts/block/:id — Unblock a phone number
router.delete("/contacts/block/:id", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const id = String(req.params["id"] ?? "");

  await db
    .delete(blockedContactsTable)
    .where(and(eq(blockedContactsTable.id, id), eq(blockedContactsTable.userId, userId)));

  res.json({ ok: true });
});

// POST /contacts/block-bulk — Batch block contacts from phone book or bulk paste
router.post("/contacts/block-bulk", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { phoneNumbers } = req.body as { phoneNumbers?: string[] };

  if (!Array.isArray(phoneNumbers)) {
    res.status(400).json({ error: "invalid_payload", message: "phoneNumbers array required" });
    return;
  }

  const normalized = Array.from(
    new Set(phoneNumbers.map((p) => normalizeRwandaPhone(String(p || ""))).filter((p) => p.length >= 6))
  );

  if (normalized.length === 0) {
    res.json({ success: true, count: 0 });
    return;
  }

  const existing = await db
    .select({ blockedPhone: blockedContactsTable.blockedPhone })
    .from(blockedContactsTable)
    .where(eq(blockedContactsTable.userId, userId));

  const existingSet = new Set(existing.map((e) => e.blockedPhone));
  const toInsert = normalized.filter((p) => !existingSet.has(p));

  if (toInsert.length > 0) {
    await db.insert(blockedContactsTable).values(
      toInsert.map((blockedPhone) => ({
        userId,
        blockedPhone,
      }))
    );
  }

  res.json({ success: true, count: toInsert.length });
});

export default router;
