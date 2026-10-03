// リサーチAI：季節ネタ・地域の話題・トレンドを検索して調べる
import { generateText, generateWithSearch } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";
import type { Account } from "@/lib/types";
import { describeAccount, today } from "./context";

// Google検索が使えないときに、AIへ追加で伝える注意
const NO_SEARCH_NOTE = `
# 注意：今回はGoogle検索が使えません
あなたの知識だけで書いてください。
- 季節ネタ・ジャンルの定番トレンドを中心にする。
- 店名・イベント名・期間限定メニューなど、最新かどうか分からない固有の情報は書かないか、必ず「要確認」と付ける。
`;

export async function runResearch(account: Account) {
  const system = await loadPrompt("research");
  const prompt = `今日の日付: ${today()}\n\n# アカウント情報\n${describeAccount(account)}\n\nこのアカウントの次の企画に使えるネタを調べてください。`;

  try {
    return await generateWithSearch({ system, prompt });
  } catch (e) {
    // 検索の利用枠オーバーなどで失敗したら、検索なしで続ける（企画づくりを止めないため）
    console.warn("Google検索つきリサーチに失敗したので、検索なしで続けます:", e);
    const text = await generateText({ system: system + NO_SEARCH_NOTE, prompt });
    return {
      text: `⚠️ Google検索が使えなかったため、AIの知識だけで作成したメモです。最新の店舗情報やイベントは必ず確認してください。\n\n${text}`,
      sources: [],
    };
  }
}
