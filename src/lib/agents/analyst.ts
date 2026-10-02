// 分析AI：投稿データ・インサイト・競合データを分析する
import { generateJson } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";
import type { Account, Analysis } from "@/lib/types";
import { describeAccount, today } from "./context";

const schema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    good_points: { type: "array", items: { type: "string" } },
    issues: { type: "array", items: { type: "string" } },
    metrics_comment: { type: "string" },
  },
  required: ["headline", "good_points", "issues", "metrics_comment"],
};

export async function runAnalyst(input: {
  account: Account;
  kindLabel: string; // 「48時間後レポート」など
  data: unknown; // 分析対象の投稿・インサイト・競合データ
}): Promise<Analysis> {
  return generateJson<Analysis>({
    system: await loadPrompt("analyst"),
    prompt: [
      `今日の日付: ${today()}`,
      `# レポート種類\n${input.kindLabel}`,
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# データ（JSON）\n${JSON.stringify(input.data, null, 2)}`,
    ].join("\n\n"),
    schema,
  });
}
