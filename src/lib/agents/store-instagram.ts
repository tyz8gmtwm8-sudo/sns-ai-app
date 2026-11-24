// インスタ探しAI：Google検索を使って、お店の公式Instagramアカウントの候補を探す
// ※ AIの答えは間違うことがあるので、画面では「候補」として出し、本人に選んでもらう
import { generateWithSearch } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";

export type InstagramCandidate = { username: string; reason: string };

// Instagramのユーザー名に使える文字（英数字・ピリオド・アンダーバー、30文字まで）
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;
// アカウントではないInstagramのページ（URLから拾ったときに除く）
const NOT_ACCOUNT = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "tv", "about", "developer"]);

export async function findStoreInstagram(store: { name: string; address: string; website: string | null }) {
  const { text } = await generateWithSearch({
    system: await loadPrompt("store-instagram"),
    prompt: [
      `# 店名\n${store.name}`,
      `# 住所\n${store.address || "不明"}`,
      `# 公式サイト\n${store.website ?? "不明"}`,
    ].join("\n\n"),
  });

  const found = new Map<string, InstagramCandidate>();
  const add = (raw: string, reason: string) => {
    const username = raw.replace(/^@/, "").replace(/\.$/, "").toLowerCase();
    if (USERNAME.test(username) && !NOT_ACCOUNT.has(username) && !found.has(username)) {
      found.set(username, { username, reason: reason.trim() });
    }
  };

  // 「@ユーザー名 | 理由」の形の行を読み取る
  for (const line of text.split("\n")) {
    const m = line.match(/@([A-Za-z0-9._]{1,30})\s*[|｜]\s*(.*)$/);
    if (m) add(m[1], m[2]);
  }
  // 形が崩れていても、本文にInstagramのURLがあれば拾う
  for (const m of text.matchAll(/instagram\.com\/([A-Za-z0-9._]{1,30})/gi)) add(m[1], "");

  return [...found.values()].slice(0, 3);
}
