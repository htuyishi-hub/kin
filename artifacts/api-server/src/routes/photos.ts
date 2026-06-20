import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, profilePhotosTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

function mapPhoto(p: typeof profilePhotosTable.$inferSelect) {
  return {
    id:          p.id,
    storagePath: p.storagePath,
    publicUrl:   p.publicUrl ?? null,
    isPrimary:   p.isPrimary ?? false,
    isBlurred:   p.isBlurred ?? true,
    sortOrder:   p.sortOrder ?? 0,
    createdAt:   p.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

// GET /me/photos
router.get("/me/photos", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const photos = await db
    .select()
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, userId));
  res.json(photos.map(mapPhoto));
});

// POST /me/photos — accepts Supabase Storage URL or legacy base64
router.post("/me/photos", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const {
    publicUrl,
    storagePath: storagePathParam,
    base64Data,
    isPrimary   = false,
    sortOrder: sortOrderParam,
  } = req.body as {
    publicUrl?:   string;
    storagePath?: string;
    base64Data?:  string;
    isPrimary?:   boolean;
    sortOrder?:   number;
  };

  const storagePath = storagePathParam ?? base64Data;
  if (!storagePath && !publicUrl) {
    res.status(400).json({ error: "bad_request", message: "publicUrl or base64Data is required" });
    return;
  }

  if (isPrimary) {
    await db
      .update(profilePhotosTable)
      .set({ isPrimary: false })
      .where(eq(profilePhotosTable.userId, userId));
  }

  const existing = await db
    .select()
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, userId));

  const shouldBePrimary = isPrimary || existing.length === 0;
  const sortOrder       = sortOrderParam ?? existing.length;

  const [photo] = await db
    .insert(profilePhotosTable)
    .values({
      userId,
      storagePath: storagePath ?? publicUrl ?? "",
      publicUrl:   publicUrl ?? null,
      isPrimary:   shouldBePrimary,
      isBlurred:   !shouldBePrimary,
      sortOrder:   sortOrder as any,
    })
    .returning();

  res.status(201).json(mapPhoto(photo!));
});

// DELETE /me/photos/:photoId
router.delete("/me/photos/:photoId", requireAuth, async (req, res) => {
  const userId      = (req as AuthedRequest).userId;
  const { photoId } = req.params;

  const deleted = await db
    .delete(profilePhotosTable)
    .where(
      and(
        eq(profilePhotosTable.id,     String(photoId)),
        eq(profilePhotosTable.userId, userId)
      )
    )
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "not_found", message: "Photo not found" });
    return;
  }
  res.json({ message: "Photo deleted" });
});

export default router;
