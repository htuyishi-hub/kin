import { Router, type IRouter } from "express";
import { requireAuth, type AuthedRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

const FALLBACK_EN_OPENERS = [
  "Hey {{name}}! Question Coffee or Inzora Rooftop for a first vibe check? ☕",
  "Okay {{name}}, important Kigali debate: brochette at Sundowner or gelato at Kimihurura? 😄",
  "{{name}}, your energy stood out right away—how's your week treating you?",
  "If we had 30 minutes free in Kigali right now, where are we going first?",
];

const FALLBACK_RW_OPENERS = [
  "Muraho {{name}}! Ikawa yo muri Question Coffee cyangwa rooftop ya Inzora? ☕",
  "{{name}}, ikibazo gikomeye i Kigali: brochette cyangwa gelato i Kimihurura? 😄",
  "{{name}}, imbaraga zawe zanshimishije cyane—icyumweru cyawe kimeze gite?",
  "Tubonye iminota 30 i Kigali ubu, twajya he mbere?",
];

const FALLBACK_EN_COMEBACKS = [
  "Haha fair point! Now I'm curious what else surprises people about you.",
  "Love that answer—sounds like we'd actually get along in real life.",
  "10/10 response. When are we testing this theory over coffee?",
  "You just made my day with that—tell me the story behind it!",
];

const FALLBACK_RW_COMEBACKS = [
  "Haha ni ukuri! Ubu nshaka kumenya ikindi kintu gitangaje kuri wowe.",
  "Igisubizo cyiza cyane—biragaragara ko twahuza neza no hanze ya app.",
  "Igisubizo cya 10/10! Tuzabigeragereza ryari kuri coffee?",
  "Wanshimishije cyane—mbwira inkuru iri inyuma yabyo!",
];

router.post("/ai/wingman", requireAuth, async (req, res) => {
  const _userId = (req as AuthedRequest).userId;
  const { partnerName = "friend", lastMessage = "", language = "en" } = req.body ?? {};
  const isRw = language === "rw";
  const shortName = String(partnerName).trim().split(/\s+/)[0] || (isRw ? "nshuti" : "friend");

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const prompt = lastMessage
        ? `You are a charming, respectful dating wingman in Kigali, Rwanda. Write ONE short, natural, playful reply (max 18 words, no quotes) in ${isRw ? "Kinyarwanda" : "English"} responding to "${String(lastMessage).slice(0, 200)}" from ${shortName}.`
        : `You are a charming, respectful dating wingman in Kigali, Rwanda. Write ONE short, warm, playful first-message opener (max 18 words, no quotes) in ${isRw ? "Kinyarwanda" : "English"} for ${shortName}.`;

      const apiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 60 },
          }),
        },
      );
      if (apiRes.ok) {
        const data = (await apiRes.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          res.json({ suggestion: text.replace(/^["']|["']$/g, ""), source: "gemini" });
          return;
        }
      }
    } catch {
      // Fall back to curated local suggestions
    }
  }

  const pool = lastMessage
    ? (isRw ? FALLBACK_RW_COMEBACKS : FALLBACK_EN_COMEBACKS)
    : (isRw ? FALLBACK_RW_OPENERS : FALLBACK_EN_OPENERS);
  const template = pool[Math.floor(Math.random() * pool.length)];
  const suggestion = template.replace(/\{\{name\}\}/g, shortName);

  res.json({ suggestion, source: "smart" });
});

export default router;
