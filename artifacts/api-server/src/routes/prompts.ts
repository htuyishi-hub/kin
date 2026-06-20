import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, promptDefinitionsTable, microPromptsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router = Router();

// GET /prompts
router.get("/prompts", requireAuth, async (_req, res) => {
  const prompts = await db.select().from(promptDefinitionsTable);
  res.json(prompts.map((p) => ({
    key: p.key,
    promptText: p.promptText,
    promptRw: p.promptRw,
    tier: p.tier ?? null,
    intent: p.intent ?? null,
  })));
});

// GET /me/prompts
router.get("/me/prompts", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const answers = await db
    .select({
      id: microPromptsTable.id,
      promptKey: microPromptsTable.promptKey,
      answer: microPromptsTable.answer,
      sortOrder: microPromptsTable.sortOrder,
      promptText: promptDefinitionsTable.promptText,
      promptRw: promptDefinitionsTable.promptRw,
    })
    .from(microPromptsTable)
    .innerJoin(promptDefinitionsTable, eq(microPromptsTable.promptKey, promptDefinitionsTable.key))
    .where(eq(microPromptsTable.userId, userId));

  res.json(answers.map((a) => ({
    id: a.id,
    promptKey: a.promptKey,
    promptText: a.promptText,
    promptRw: a.promptRw,
    answer: a.answer,
    sortOrder: a.sortOrder ?? 0,
  })));
});

// PUT /me/prompts
router.put("/me/prompts", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const { answers } = req.body as {
    answers?: Array<{ promptKey: string; answer: string }>;
  };

  if (!Array.isArray(answers) || answers.length === 0) {
    res.status(400).json({ error: "bad_request", message: "answers array is required" });
    return;
  }

  // Delete existing answers
  await db.delete(microPromptsTable).where(eq(microPromptsTable.userId, userId));

  // Insert new answers
  const inserted = await db
    .insert(microPromptsTable)
    .values(
      answers.map((a, i) => ({
        userId,
        promptKey: a.promptKey,
        answer: a.answer.slice(0, 160),
        sortOrder: i as any,
      })),
    )
    .returning();

  // Fetch with prompt text
  const withText = await db
    .select({
      id: microPromptsTable.id,
      promptKey: microPromptsTable.promptKey,
      answer: microPromptsTable.answer,
      sortOrder: microPromptsTable.sortOrder,
      promptText: promptDefinitionsTable.promptText,
      promptRw: promptDefinitionsTable.promptRw,
    })
    .from(microPromptsTable)
    .innerJoin(promptDefinitionsTable, eq(microPromptsTable.promptKey, promptDefinitionsTable.key))
    .where(eq(microPromptsTable.userId, userId));

  res.json(withText.map((a) => ({
    id: a.id,
    promptKey: a.promptKey,
    promptText: a.promptText,
    promptRw: a.promptRw,
    answer: a.answer,
    sortOrder: a.sortOrder ?? 0,
  })));
});

export default router;
