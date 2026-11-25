import { Router } from "express";
import { randomUUID } from "crypto";
import { parseBuffer } from "music-metadata";
import { eq, and, or, gte } from "drizzle-orm";
import { db, profilesTable, profilePhotosTable, matchesTable, reportsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";
import { getStorageAdmin } from "../lib/storage.js";

const router = Router();

function isVoiceIntroEnabled(): boolean {
  return process.env.VOICE_INTRO_ENABLED !== "false" && process.env.VOICE_INTRO_ENABLED !== "0";
}

// =============================================================================
// PHOTO ENDPOINTS
// =============================================================================

// POST /media/photo/upload-url
router.post("/media/photo/upload-url", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  const [userProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (
    !userProfile ||
    userProfile.accountStatus === "banned" ||
    userProfile.accountStatus === "suspended" ||
    userProfile.profileActive === false ||
    userProfile.profilePaused === true
  ) {
    res.status(403).json({ error: "forbidden", code: "USER_NOT_ACTIVE", message: "Account must be active" });
    return;
  }

  const existingPhotos = await db
    .select()
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, userId));

  const MAX_PHOTOS = 3;
  const reqSlot = typeof req.body?.slotIndex === "number" ? req.body.slotIndex : undefined;

  const isReplacing = reqSlot !== undefined && existingPhotos.some(p => p.sortOrder === reqSlot);
  if (!isReplacing && existingPhotos.length >= MAX_PHOTOS) {
    res.status(400).json({ error: "limit_reached", code: "MAX_PHOTOS_REACHED", message: "Maximum photos reached" });
    return;
  }

  let slotIndex = reqSlot;
  if (slotIndex === undefined) {
    const usedSlots = new Set(existingPhotos.map(p => p.sortOrder ?? 0));
    for (let i = 0; i < MAX_PHOTOS; i++) {
      if (!usedSlots.has(i)) {
        slotIndex = i;
        break;
      }
    }
    if (slotIndex === undefined) slotIndex = 0;
  }

  const path = `photos/${userId}/${randomUUID()}.jpg`;

  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data, error } = await admin.storage
    .from("profile-photos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    res.status(500).json({ error: "storage_error", message: error?.message });
    return;
  }

  res.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    slotIndex,
    isPrimary: slotIndex === 0,
    expiresIn: 120,
  });
});

// POST /media/photo/confirm
router.post("/media/photo/confirm", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { path, slotIndex } = req.body as { path?: string; slotIndex?: number };

  if (!path || typeof path !== "string" || !path.startsWith(`photos/${userId}/`) || !path.endsWith(".jpg")) {
    res.status(400).json({ error: "invalid_path", code: "INVALID_PATH", message: "Invalid photo path" });
    return;
  }

  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data: blob, error: downloadError } = await admin.storage
    .from("profile-photos")
    .download(path);

  if (downloadError || !blob) {
    res.status(400).json({ error: "file_not_found", code: "FILE_NOT_FOUND", message: "Uploaded file not found" });
    return;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Check size: cap 500 KB (512,000 bytes)
  if (buffer.length > 500 * 1024) {
    await admin.storage.from("profile-photos").remove([path]);
    res.status(400).json({ error: "file_too_large", code: "FILE_TOO_LARGE", message: "Photo exceeds 500 KB" });
    return;
  }

  // Check JPEG magic bytes: 0xFF, 0xD8, 0xFF
  if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
    await admin.storage.from("profile-photos").remove([path]);
    res.status(400).json({ error: "invalid_format", code: "INVALID_IMAGE_FORMAT", message: "Only JPEG images are permitted" });
    return;
  }

  const slot = typeof slotIndex === "number" ? slotIndex : 0;
  const isPrimary = slot === 0;

  // If replacing existing photo in this slot, delete old object from storage
  const existing = await db
    .select()
    .from(profilePhotosTable)
    .where(and(eq(profilePhotosTable.userId, userId), eq(profilePhotosTable.sortOrder, slot)))
    .limit(1);

  if (existing[0]) {
    if (existing[0].storagePath && existing[0].storagePath !== path) {
      await admin.storage.from("profile-photos").remove([existing[0].storagePath]);
    }
    await db.delete(profilePhotosTable).where(eq(profilePhotosTable.id, existing[0].id));
  }

  if (isPrimary) {
    await db
      .update(profilePhotosTable)
      .set({ isPrimary: false })
      .where(eq(profilePhotosTable.userId, userId));
  }

  const [newPhoto] = await db
    .insert(profilePhotosTable)
    .values({
      userId,
      storagePath: path,
      isPrimary,
      isBlurred: !isPrimary,
      sortOrder: slot as any,
    })
    .returning();

  res.status(201).json({
    id: newPhoto!.id,
    path: newPhoto!.storagePath,
    isPrimary: newPhoto!.isPrimary,
    sortOrder: newPhoto!.sortOrder,
  });
});

// GET /media/photo/:photoId/url
router.get("/media/photo/:photoId/url", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rawPhotoId = String(req.params.photoId);

  let [photo] = await db
    .select()
    .from(profilePhotosTable)
    .where(eq(profilePhotosTable.id, rawPhotoId))
    .limit(1);

  if (!photo) {
    const targetUserId = rawPhotoId === "primary" ? userId : rawPhotoId;
    const [primaryPhoto] = await db
      .select()
      .from(profilePhotosTable)
      .where(and(eq(profilePhotosTable.userId, targetUserId), eq(profilePhotosTable.isPrimary, true)))
      .limit(1);
    if (primaryPhoto) {
      photo = primaryPhoto;
    }
  }

  if (!photo) {
    res.status(404).json({ error: "not_found", code: "PHOTO_NOT_FOUND", message: "Photo not found" });
    return;
  }

  if (photo.userId !== userId) {
    const [viewer] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);

    if (!viewer || viewer.isVerified !== true || viewer.accountStatus !== "active" || viewer.profileActive === false || viewer.profilePaused === true) {
      res.status(403).json({ error: "forbidden", code: "VIEWER_NOT_ACTIVE", message: "Active verified status required" });
      return;
    }

    const [owner] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, photo.userId))
      .limit(1);

    if (!owner || owner.accountStatus !== "active" || owner.profileActive === false || owner.profilePaused === true) {
      res.status(404).json({ error: "not_found", code: "OWNER_INACTIVE", message: "Owner profile inactive" });
      return;
    }

    const [blocked] = await db
      .select()
      .from(reportsTable)
      .where(
        or(
          and(eq(reportsTable.reporterId, userId), eq(reportsTable.reportedId, photo.userId)),
          and(eq(reportsTable.reporterId, photo.userId), eq(reportsTable.reportedId, userId))
        )
      )
      .limit(1);

    if (blocked) {
      res.status(403).json({ error: "forbidden", code: "USER_BLOCKED", message: "Access restricted" });
      return;
    }

    // Blurred/unblurred rule: primary photo visible, secondary photo requires revealed match (Phase 2+)
    if (!photo.isPrimary && photo.sortOrder !== 0) {
      const [match] = await db
        .select()
        .from(matchesTable)
        .where(
          and(
            or(
              and(eq(matchesTable.userA, userId), eq(matchesTable.userB, photo.userId)),
              and(eq(matchesTable.userA, photo.userId), eq(matchesTable.userB, userId))
            ),
            or(
              gte(matchesTable.conversationPhase, 2),
              and(eq(matchesTable.phase1CompleteA, true), eq(matchesTable.phase1CompleteB, true))
            )
          )
        )
        .limit(1);

      if (!match) {
        res.status(403).json({ error: "forbidden", code: "PHOTO_LOCKED", message: "Photo unlocked only after match reveal" });
        return;
      }
    }
  }

  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data, error } = await admin.storage
    .from("profile-photos")
    .createSignedUrl(photo.storagePath, 300);

  if (error || !data) {
    res.status(500).json({ error: "signed_url_failed", message: error?.message });
    return;
  }

  res.json({
    photoId: photo.id,
    url: data.signedUrl,
    expiresIn: 300,
    isPrimary: photo.isPrimary,
  });
});

// DELETE /media/photo/:photoId
router.delete("/media/photo/:photoId", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { photoId } = req.params;

  const [photo] = await db
    .select()
    .from(profilePhotosTable)
    .where(and(eq(profilePhotosTable.id, String(photoId)), eq(profilePhotosTable.userId, userId)))
    .limit(1);

  if (!photo) {
    res.status(404).json({ error: "not_found", code: "PHOTO_NOT_FOUND" });
    return;
  }

  const admin = getStorageAdmin();
  if (admin && photo.storagePath) {
    await admin.storage.from("profile-photos").remove([photo.storagePath]);
  }

  await db.delete(profilePhotosTable).where(eq(profilePhotosTable.id, photo.id));
  res.json({ success: true, message: "Photo deleted" });
});

// =============================================================================
// VOICE INTRO ENDPOINTS
// =============================================================================

// POST /media/voice/upload-url
router.post("/media/voice/upload-url", requireAuth, async (req, res) => {
  if (!isVoiceIntroEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED" });
    return;
  }

  const userId = (req as AuthedRequest).userId;

  const [userProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (!userProfile || userProfile.accountStatus !== "active" || userProfile.profileActive === false || userProfile.profilePaused === true) {
    res.status(403).json({ error: "forbidden", code: "USER_NOT_ACTIVE", message: "Account must be active" });
    return;
  }

  const path = `voice/${userId}/${randomUUID()}.m4a`;

  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data, error } = await admin.storage
    .from("voice-intros")
    .createSignedUploadUrl(path);

  if (error || !data) {
    res.status(500).json({ error: "storage_error", message: error?.message });
    return;
  }

  res.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    expiresIn: 120,
  });
});

// POST /media/voice/confirm
router.post("/media/voice/confirm", requireAuth, async (req, res) => {
  if (!isVoiceIntroEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED" });
    return;
  }

  const userId = (req as AuthedRequest).userId;
  const { path } = req.body as { path?: string };

  if (!path || typeof path !== "string" || !path.startsWith(`voice/${userId}/`)) {
    res.status(400).json({ error: "invalid_path", code: "INVALID_PATH", message: "Invalid voice intro path" });
    return;
  }

  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data: blob, error: downloadError } = await admin.storage
    .from("voice-intros")
    .download(path);

  if (downloadError || !blob) {
    res.status(400).json({ error: "file_not_found", code: "FILE_NOT_FOUND", message: "Uploaded file not found" });
    return;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Check size cap: 2 MB (2 * 1024 * 1024 = 2,097,152 bytes)
  if (buffer.length > 2 * 1024 * 1024) {
    await admin.storage.from("voice-intros").remove([path]);
    res.status(400).json({ error: "file_too_large", code: "VOICE_INTRO_TOO_LARGE", message: "Voice intro exceeds 2 MB" });
    return;
  }

  // Measure audio duration using music-metadata
  let durationSec = 0;
  try {
    const metadata = await parseBuffer(buffer);
    durationSec = metadata.format.duration || 0;
  } catch {
    durationSec = 0;
  }

  if (durationSec < 1 || durationSec > 30) {
    await admin.storage.from("voice-intros").remove([path]);
    res.status(400).json({
      error: "invalid_duration",
      code: durationSec < 1 ? "VOICE_INTRO_TOO_SHORT" : "VOICE_INTRO_TOO_LONG",
      message: "Voice intro duration must be between 1 and 30 seconds.",
    });
    return;
  }

  const [existingProfile] = await db
    .select({ voiceIntroPath: profilesTable.voiceIntroPath })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (existingProfile?.voiceIntroPath && existingProfile.voiceIntroPath !== path) {
    await admin.storage.from("voice-intros").remove([existingProfile.voiceIntroPath]);
  }

  const durationMs = Math.round(durationSec * 1000);

  await db
    .update(profilesTable)
    .set({
      voiceIntroPath: path,
      voiceIntroDurationMs: durationMs,
    } as any)
    .where(eq(profilesTable.id, userId));

  res.status(201).json({
    success: true,
    voiceIntroPath: path,
    durationMs,
  });
});

// GET /media/voice/:userId/url
router.get("/media/voice/:userId/url", requireAuth, async (req, res) => {
  if (!isVoiceIntroEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED" });
    return;
  }

  const requesterId = (req as AuthedRequest).userId;
  const rawTarget = String(req.params.userId);
  const targetUserId = rawTarget === "me" ? requesterId : rawTarget;

  let [targetProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, targetUserId))
    .limit(1);

  if (!targetProfile && rawTarget.includes("/")) {
    const [byPath] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.voiceIntroPath, rawTarget))
      .limit(1);
    if (byPath) targetProfile = byPath;
  }

  if (!targetProfile || !targetProfile.voiceIntroPath) {
    res.status(404).json({ error: "not_found", code: "VOICE_NOT_FOUND" });
    return;
  }

  if (requesterId !== targetUserId) {
    const [viewer] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, requesterId))
      .limit(1);

    if (!viewer || viewer.isVerified !== true || viewer.accountStatus !== "active" || viewer.profileActive === false || viewer.profilePaused === true) {
      res.status(403).json({ error: "forbidden", code: "VIEWER_NOT_ACTIVE" });
      return;
    }

    if (targetProfile.accountStatus !== "active" || targetProfile.profileActive === false || targetProfile.profilePaused === true) {
      res.status(404).json({ error: "not_found", code: "TARGET_INACTIVE" });
      return;
    }
  }

  const admin = getStorageAdmin();
  if (!admin) {
    res.status(503).json({ error: "storage_not_configured", code: "STORAGE_NOT_CONFIGURED" });
    return;
  }

  const { data, error } = await admin.storage
    .from("voice-intros")
    .createSignedUrl(targetProfile.voiceIntroPath, 300);

  if (error || !data) {
    res.status(500).json({ error: "signed_url_failed", message: error?.message });
    return;
  }

  res.json({
    userId: targetUserId,
    url: data.signedUrl,
    durationMs: targetProfile.voiceIntroDurationMs,
    expiresIn: 300,
  });
});

// DELETE /media/voice
router.delete("/media/voice", requireAuth, async (req, res) => {
  if (!isVoiceIntroEnabled()) {
    res.status(404).json({ error: "not_found", code: "FEATURE_DISABLED" });
    return;
  }

  const userId = (req as AuthedRequest).userId;

  const [existing] = await db
    .select({ voiceIntroPath: profilesTable.voiceIntroPath })
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);

  if (existing?.voiceIntroPath) {
    const admin = getStorageAdmin();
    if (admin) {
      await admin.storage.from("voice-intros").remove([existing.voiceIntroPath]);
    }
  }

  await db
    .update(profilesTable)
    .set({
      voiceIntroPath: null,
      voiceIntroDurationMs: null,
    } as any)
    .where(eq(profilesTable.id, userId));

  res.json({ success: true, message: "Voice intro deleted" });
});

export default router;
