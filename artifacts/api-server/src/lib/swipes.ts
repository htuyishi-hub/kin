import { eq, and, sql } from "drizzle-orm";
import { db, interestsTable, passesTable, profilesTable } from "@workspace/db";

export const FREE_DAILY_SWIPES = parseInt(process.env.SWIPE_DAILY_LIMIT || "25", 10);
export const WHATSAPP_BONUS_SWIPES = 30;

export function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getSwipeStatus(userId: string) {
  const today = getTodayDateStr();

  const [[interestCount], [passCount], [profile]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(interestsTable)
      .where(
        and(
          eq(interestsTable.fromUser, userId),
          sql`${interestsTable.createdAt} >= CURRENT_DATE`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(passesTable)
      .where(
        and(
          eq(passesTable.userId, userId),
          sql`${passesTable.createdAt} >= CURRENT_DATE`
        )
      ),
    db
      .select({
        bonusSwipesToday: profilesTable.bonusSwipesToday,
        bonusSwipesDate: profilesTable.bonusSwipesDate,
        inviteCode: profilesTable.inviteCode,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1),
  ]);

  const usedToday = (interestCount?.count ?? 0) + (passCount?.count ?? 0);
  const bonusSwipesToday =
    profile?.bonusSwipesDate === today ? (profile?.bonusSwipesToday ?? 0) : 0;
  const limit = FREE_DAILY_SWIPES + bonusSwipesToday;
  const remaining = Math.max(0, limit - usedToday);
  const baseUrl = (process.env["APP_URL"] ?? "https://kinn.ink").replace(/\/+$/, "");
  const inviteCode = profile?.inviteCode ?? null;
  const inviteLink = inviteCode ? `${baseUrl}/invite/${inviteCode}` : null;

  return {
    usedToday,
    limit,
    remaining,
    bonusSwipesToday,
    inviteCode,
    inviteLink,
  };
}
