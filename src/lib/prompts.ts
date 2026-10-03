// プロンプト（AIへの指示文）は prompts/ フォルダのMarkdownファイルに分けて管理する。
// コードを触らずに、ファイルを編集するだけでAIの振る舞いを調整できる。
import { readFile } from "node:fs/promises";
import path from "node:path";

export type AgentName =
  | "chief" // 編集長AI
  | "research" // リサーチAI
  | "planner" // 企画AI
  | "writer" // 投稿作成AI
  | "video" // 動画構成AI
  | "analyst" // 分析AI
  | "hearing" // AIヒアリング
  | "screenshot"; // スクショ読み取り

export async function loadPrompt(name: AgentName): Promise<string> {
  const file = path.join(process.cwd(), "prompts", `${name}.md`);
  return readFile(file, "utf8");
}
