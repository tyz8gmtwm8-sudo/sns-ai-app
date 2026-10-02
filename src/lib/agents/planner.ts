// 企画AI：企画案を3件作る
import { generateJson } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";
import type { Account } from "@/lib/types";
import { describeAccount, today } from "./context";

const schema = {
  type: "object",
  properties: {
    plans: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          post_type: { type: "string", enum: ["reel", "carousel", "image"] },
          concept: { type: "string" },
          reason: { type: "string" },
        },
        required: ["title", "post_type", "concept", "reason"],
      },
    },
    recommended_post_type: { type: "string" },
  },
  required: ["plans", "recommended_post_type"],
};

export type PlannerResult = {
  plans: { title: string; post_type: "reel" | "carousel" | "image"; concept: string; reason: string }[];
  recommended_post_type: string;
};

export async function runPlanner(input: {
  account: Account;
  researchMemo: string;
  competitorSummary: string;
  pastImprovements: string;
  instruction?: string;
}): Promise<PlannerResult> {
  return generateJson<PlannerResult>({
    system: await loadPrompt("planner"),
    prompt: [
      `今日の日付: ${today()}`,
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# リサーチメモ\n${input.researchMemo}`,
      `# 競合分析\n${input.competitorSummary || "まだデータなし"}`,
      `# 過去の改善案\n${input.pastImprovements || "まだなし"}`,
      input.instruction ? `# 運営者からの追加指示\n${input.instruction}` : "",
    ].join("\n\n"),
    schema,
  });
}
