// 企画AI：企画案を3件作る／1件だけ修正する
import { generateJson, type ImageInput } from "@/lib/gemini";
import { loadAgentPrompt } from "@/lib/prompts";
import type { Account } from "@/lib/types";
import { describeAccount, today } from "./context";

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

const schema = {
  type: "object",
  properties: {
    plans: { type: "array", minItems: 3, maxItems: 3, items: planSchema },
    recommended_post_type: { type: "string" },
  },
  required: ["plans", "recommended_post_type"],
};

export type PlanDraft = { title: string; post_type: "reel" | "carousel" | "image"; concept: string; reason: string };
export type PlannerResult = { plans: PlanDraft[]; recommended_post_type: string };

const formatPlans = (plans: PlanDraft[]) =>
  plans.map((p, i) => `案${i + 1}：${p.title}（${p.post_type}）\n${p.concept}`).join("\n\n");

/** 企画案を3件作る */
export async function runPlanner(input: {
  account: Account;
  researchMemo: string;
  competitorSummary: string;
  pastImprovements: string;
  ideas?: { text: string; images: ImageInput[] }; // ネタ帳
  previousPlans?: PlanDraft[]; // 前回出した案（作り直しのとき）
  instruction?: string;
}): Promise<PlannerResult> {
  return generateJson<PlannerResult>({
    system: await loadAgentPrompt("planner", input.account),
    prompt: [
      `今日の日付: ${today()}`,
      `# アカウント情報\n${describeAccount(input.account)}`,
      input.ideas?.text ? `# ネタ帳（この中のネタだけを使って企画する）\n${input.ideas.text}` : "",
      `# リサーチメモ\n${input.researchMemo}`,
      `# 競合分析\n${input.competitorSummary || "まだデータなし"}`,
      `# 過去の改善案\n${input.pastImprovements || "まだなし"}`,
      input.previousPlans?.length ? `# 前回の案（運営者は採用しなかった。同じ案はくり返さない）\n${formatPlans(input.previousPlans)}` : "",
      // 指示は最後に置き、最優先であることを明記する
      input.instruction ? `# 運営者からの指示（最優先で必ず反映する）\n${input.instruction}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    images: input.ideas?.images,
    schema,
  });
}

/** 企画案を1件だけ、指示どおりに修正する */
export async function runPlanRevision(input: {
  account: Account;
  current: PlanDraft;
  instruction: string;
  ideas?: { text: string; images: ImageInput[] };
}): Promise<PlanDraft> {
  return generateJson<PlanDraft>({
    system: await loadAgentPrompt("planner", input.account),
    prompt: [
      `今日の日付: ${today()}`,
      `# アカウント情報\n${describeAccount(input.account)}`,
      input.ideas?.text ? `# ネタ帳\n${input.ideas.text}` : "",
      `# 修正する案\n${formatPlans([input.current])}\n理由：${input.current.reason}`,
      `# 運営者からの指示（最優先で必ず反映する）\n${input.instruction}`,
      "# 依頼\nこの1件だけを、指示どおりに修正してください。指示に関係ない良いところは残してください。",
    ]
      .filter(Boolean)
      .join("\n\n"),
    images: input.ideas?.images,
    schema: planSchema,
  });
}
