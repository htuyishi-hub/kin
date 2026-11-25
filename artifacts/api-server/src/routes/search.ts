import { Router } from "express";
import { eq, and, ne, ilike, desc, inArray, asc } from "drizzle-orm";
import {
  db,
  profilesTable,
  profilePhotosTable,
  nameSearchesTable,
  photoCommentsTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// GET /people/search?q=Keza — Search members by name and log search
router.get("/people/search", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  const isAnonymous = req.query["anonymous"] === "true";

  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }

  const matched = await db
    .select({
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      campusName: profilesTable.campusName,
      city: profilesTable.city,
      faculty: profilesTable.faculty,
      isVerified: profilesTable.isVerified,
      institutionVerified: profilesTable.institutionVerified,
      primaryIntent: profilesTable.primaryIntent,
    })
    .from(profilesTable)
    .where(
      and(
        ne(profilesTable.id, userId),
        eq(profilesTable.profileActive, true),
        eq(profilesTable.isIncognito, false),
        ilike(profilesTable.fullName, `%${q}%`)
      )
    )
    .limit(15);

  if (matched.length > 0) {
    if (isAnonymous) {
      await db.insert(paymentsTable).values({
        userId,
        productType: "anonymous_search",
        amountRwf: 100,
        status: "completed",
        fulfilled: true,
        completedAt: new Date(),
      });
    }

    await db.insert(nameSearchesTable).values(
      matched.map((m) => ({
        searcherId: userId,
        searchedQuery: q,
        targetProfileId: m.id,
        isAnonymous,
        isUnmasked: false,
      }))
    );
  }

  const matchedIds = matched.map((m) => m.id);
  const photos = matchedIds.length
    ? await db
        .select({
          userId: profilePhotosTable.userId,
          publicUrl: profilePhotosTable.publicUrl,
          storagePath: profilePhotosTable.storagePath,
        })
        .from(profilePhotosTable)
        .where(inArray(profilePhotosTable.userId, matchedIds))
        .orderBy(asc(profilePhotosTable.sortOrder))
    : [];

  const photoMap = new Map<string, string>();
  for (const p of photos) {
    if (!photoMap.has(p.userId)) {
      const url = p.publicUrl || p.storagePath;
      if (url) photoMap.set(p.userId, url);
    }
  }

  res.json({
    results: matched.map((m) => ({
      id: m.id,
      firstName: m.fullName?.trim().split(" ")[0] ?? "kinn Member",
      campus: m.campusName ?? m.city ?? "Kigali",
      occupation: m.faculty ?? null,
      primaryIntent: m.primaryIntent ?? "Serious",
      isVerified: Boolean(m.isVerified || m.institutionVerified),
      photoUrl: photoMap.get(m.id) ?? null,
    })),
  });
});

// GET /notifications/searches — Count & list of who searched current user's name
router.get("/notifications/searches", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  const rows = await db
    .select({
      id: nameSearchesTable.id,
      searcherId: nameSearchesTable.searcherId,
      searchedQuery: nameSearchesTable.searchedQuery,
      isUnmasked: nameSearchesTable.isUnmasked,
      createdAt: nameSearchesTable.createdAt,
    })
    .from(nameSearchesTable)
    .where(
      and(
        eq(nameSearchesTable.targetProfileId, userId),
        eq(nameSearchesTable.isAnonymous, false)
      )
    )
    .orderBy(desc(nameSearchesTable.createdAt))
    .limit(25);

  const uniqueSearcherIds = Array.from(new Set(rows.map((r) => r.searcherId)));
  const isUnmasked = rows.some((r) => r.isUnmasked);

  if (!isUnmasked || uniqueSearcherIds.length === 0) {
    res.json({
      count: uniqueSearcherIds.length,
      isUnmasked: false,
      searchers: [],
    });
    return;
  }

  const profiles = await db
    .select({
      id: profilesTable.id,
      fullName: profilesTable.fullName,
      campusName: profilesTable.campusName,
      city: profilesTable.city,
    })
    .from(profilesTable)
    .where(inArray(profilesTable.id, uniqueSearcherIds));

  res.json({
    count: uniqueSearcherIds.length,
    isUnmasked: true,
    searchers: profiles.map((p) => ({
      id: p.id,
      firstName: p.fullName?.trim().split(" ")[0] ?? "kinn Member",
      campus: p.campusName ?? p.city ?? "Kigali",
    })),
  });
});

// POST /notifications/searches/reveal — 300 RWF MoMo reveal
router.post("/notifications/searches/reveal", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  await db.insert(paymentsTable).values({
    userId,
    productType: "reveal_searches",
    amountRwf: 300,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  await db
    .update(nameSearchesTable)
    .set({ isUnmasked: true })
    .where(
      and(
        eq(nameSearchesTable.targetProfileId, userId),
        eq(nameSearchesTable.isAnonymous, false)
      )
    );

  const rows = await db
    .select({ searcherId: nameSearchesTable.searcherId })
    .from(nameSearchesTable)
    .where(
      and(
        eq(nameSearchesTable.targetProfileId, userId),
        eq(nameSearchesTable.isAnonymous, false)
      )
    );

  const uniqueIds = Array.from(new Set(rows.map((r) => r.searcherId)));
  const profiles = uniqueIds.length
    ? await db
        .select({
          id: profilesTable.id,
          fullName: profilesTable.fullName,
          campusName: profilesTable.campusName,
          city: profilesTable.city,
        })
        .from(profilesTable)
        .where(inArray(profilesTable.id, uniqueIds))
    : [];

  res.json({
    revealed: true,
    amountRwf: 300,
    searchers: profiles.map((p) => ({
      id: p.id,
      firstName: p.fullName?.trim().split(" ")[0] ?? "kinn Member",
      campus: p.campusName ?? p.city ?? "Kigali",
    })),
  });
});

// POST /people/search/anonymous — 100 RWF anonymous shield
router.post("/people/search/anonymous", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;

  await db.insert(paymentsTable).values({
    userId,
    productType: "anonymous_search",
    amountRwf: 100,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  await db
    .update(nameSearchesTable)
    .set({ isAnonymous: true })
    .where(eq(nameSearchesTable.searcherId, userId));

  res.json({ anonymous: true, amountRwf: 100 });
});

// POST /photos/compliment — 200 RWF Photo Compliment ("Sell Comments")
router.post("/photos/compliment", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { targetProfileId, photoUrl, commentText } = req.body as {
    targetProfileId?: string;
    photoUrl?: string;
    commentText?: string;
  };

  if (!targetProfileId || !commentText || !commentText.trim()) {
    res.status(400).json({ error: "bad_request", message: "targetProfileId and commentText are required" });
    return;
  }

  await db.insert(paymentsTable).values({
    userId,
    productType: "photo_compliment",
    amountRwf: 200,
    status: "completed",
    fulfilled: true,
    completedAt: new Date(),
  });

  const [created] = await db
    .insert(photoCommentsTable)
    .values({
      senderId: userId,
      targetProfileId,
      photoUrl: photoUrl || "",
      commentText: commentText.trim().slice(0, 100),
      amountRwf: 200,
    })
    .returning();

  res.status(201).json({
    id: created!.id,
    amountRwf: 200,
    commentText: created!.commentText,
  });
});

// GET /photos/compliments — Received photo compliments
router.get("/photos/compliments", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select({
      id: photoCommentsTable.id,
      senderId: photoCommentsTable.senderId,
      photoUrl: photoCommentsTable.photoUrl,
      commentText: photoCommentsTable.commentText,
      giftType: photoCommentsTable.giftType,
      createdAt: photoCommentsTable.createdAt,
      senderName: profilesTable.fullName,
    })
    .from(photoCommentsTable)
    .innerJoin(profilesTable, eq(photoCommentsTable.senderId, profilesTable.id))
    .where(eq(photoCommentsTable.targetProfileId, userId))
    .orderBy(desc(photoCommentsTable.createdAt))
    .limit(20);

  res.json(
    rows.map((r) => ({
      id: r.id,
      senderId: r.senderId,
      senderFirstName: r.senderName?.trim().split(" ")[0] ?? "kinn Member",
      photoUrl: r.photoUrl,
      commentText: r.commentText,
      giftType: r.giftType ?? "comment",
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

export default router;
