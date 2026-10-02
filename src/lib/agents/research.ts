// リサーチAI：季節ネタ・地域の話題・トレンドを検索して調べる
import { generateWithSearch } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";
import type { Account } from "@/lib/types";
import { describeAccount, today } from "./context";

export async function runResearch(account: Account) {
  return generateWithSearch({
    system: await loadPrompt("research"),
    prompt: `今日の日付: ${today()}\n\n# アカウント情報\n${describeAccount(account)}\n\nこのアカウントの次の企画に使えるネタを調べてください。`,
  });
}
