// プロンプト（AIへの指示文）は prompts/ フォルダのMarkdownファイルに分けて管理する。
// コードを触らずに、ファイルを編集するだけでAIの振る舞いを調整できる。
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Account } from "@/lib/types";

export type AgentName =
  | "chief" // 編集長AI
  | "idea-review" // ネタ帳の見直し（企画AI）
  | "planner" // 企画AI
  | "writer" // 投稿作成AI
  | "video" // 動画構成AI
  | "analyst" // 分析AI
  | "hearing" // AIヒアリング
  | "screenshot"; // スクショ読み取り

const dir = path.join(process.cwd(), "prompts");

export async function loadPrompt(name: AgentName): Promise<string> {
  return readFile(path.join(dir, `${name}.md`), "utf8");
}

// ジャンル名 → prompts/genres/ のファイル名
const GENRE_FILES: Record<string, string> = {
  グルメ: "gourmet",
  美容: "beauty",
  ファッション: "fashion",
  vlog: "vlog",
  旅行: "travel",
  フィットネス: "fitness",
  ビジネス: "business",
  "勉強・資格": "study",
  その他: "other",
};

/** アカウントで選んでいるジャンルの「コツ」をまとめて読み込む */
export async function loadGenreGuide(account: Account): Promise<string> {
  const files = [...new Set(account.genres.map((g) => GENRE_FILES[g] ?? "other"))];
  const guides = await Promise.all(files.map((f) => readFile(path.join(dir, "genres", `${f}.md`), "utf8")));
  return guides.join("\n");
}

// 企画・素材づくりのAIに共通で付ける、いちばん大事な決まり
const PRIORITY_RULES = `
# 最優先ルール（他のどのルールよりも優先する）
- 「運営者からの指示」がある場合は、必ずその指示を反映する。ほかのルールと食い違うときは指示を優先する。
- 「ネタ帳」に書かれた事実（店名・商品名・価格・場所など）はそのまま正確に使う。書かれていない事実は作らず【要確認】とする。
- 複数のジャンルを選んでいる場合は、企画のテーマに合うジャンルの決まりを使う。`;

/** 基本の指示文 ＋ 最優先ルール ＋ ジャンル別のコツ をまとめて返す */
export async function loadAgentPrompt(name: AgentName, account: Account): Promise<string> {
  const [base, genre] = await Promise.all([loadPrompt(name), loadGenreGuide(account)]);
  return `${base}\n${PRIORITY_RULES}\n\n# ジャンル別の決まり\n${genre}`;
}
