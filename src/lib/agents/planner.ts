// 企画AI：ネタ帳のネタから企画を1件作る／分析をもとにネタ帳を見直す
import { generateJson, type ImageInput } from "@/lib/gemini";
import { loadAgentPrompt } from "@/lib/prompts";
import type { Account } from "@/lib/types";
import { describeAccount, today } from "./context";

// 分析でわかったこと（企画づくりとネタ帳の見直しで共通に使う）
export type AnalysisContext = { competitorSummary: string; pastImprovements: string };

const describeAnalysis = (a: AnalysisContext) =>
  [`## 競合分析\n${a.competitorSummary || "まだデータなし"}`, `## 過去の投稿の改善案\n${a.pastImprovements || "まだなし"}`].join("\n\n");

const planSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    post_type: { type: "string", enum: ["reel", "carousel", "image"] },
    concept: { type: "string" },
    reason: { type: "string" },
  },
  required: ["title", "post_type", "concept", "reason"],
};

export type PlanDraft = { title: string; post_type: "reel" | "carousel" | "image"; concept: string; reason: string };

/** ネタ帳のネタ1件から、企画を1件作る */
export async function runPlanFromIdea(input: {
  account: Account;
  analysis: AnalysisContext;
  ideas: { text: string; images: ImageInput[] }; // ネタの事実と写真
  instruction?: string;
}): Promise<PlanDraft> {
  return generateJson<PlanDraft>({
    system: await loadAgentPrompt("planner", input.account),
    prompt: [
      `今日の日付: ${today()}`,
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# ネタ帳（このネタを主役にして企画する）\n${input.ideas.text}`,
      `# 分析でわかったこと\n${describeAnalysis(input.analysis)}`,
      // 指示は最後に置き、最優先であることを明記する
      input.instruction ? `# 運営者からの指示（最優先で必ず反映する）\n${input.instruction}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    images: input.ideas.images,
    schema: planSchema,
  });
}

const reviewSchema = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: { title: { type: "string" }, advice: { type: "string" } },
        required: ["title", "advice"],
      },
    },
    advice: {
      type: "array",
      items: {
        type: "object",
        properties: { idea_no: { type: "integer" }, advice: { type: "string" } },
        required: ["idea_no", "advice"],
      },
    },
  },
  required: ["suggestions", "advice"],
};

export type IdeaReview = {
  suggestions: { title: string; advice: string }[];
  advice: { idea_no: number; advice: string }[];
};

/** 分析をもとに、次に撮るネタを提案し、未使用のネタにアドバイスを付ける */
export async function runIdeaReview(input: {
  account: Account;
  analysis: AnalysisContext;
  unusedIdeas: { title: string; memo: string }[]; // 番号は 1 から順に振る
  usedTitles: string[];
}): Promise<IdeaReview> {
  const list = input.unusedIdeas.map((idea, i) => `## ネタ${i + 1}：${idea.title}\n${idea.memo || "（メモなし）"}`).join("\n\n");
  return generateJson<IdeaReview>({
    system: await loadAgentPrompt("idea-review", input.account),
    prompt: [
      `今日の日付: ${today()}`,
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# 分析でわかったこと\n${describeAnalysis(input.analysis)}`,
      `# ネタ帳（未使用のネタ）\n${list || "まだなし（advice は空の配列にする）"}`,
      `# 使用済みのネタ（提案に出さない）\n${input.usedTitles.join("、") || "なし"}`,
    ].join("\n\n"),
    schema: reviewSchema,
  });
}
