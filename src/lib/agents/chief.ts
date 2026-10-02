// 編集長AI：タスク指示・完成報告チェック・改善案まとめ
import { generateJson, type ImageInput } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";
import type { Account, Analysis, ChiefSummary, Materials, Plan, Review } from "@/lib/types";
import { describeAccount, today } from "./context";

// タスクの種類ごとに、対応する画面へのリンクを決める
export const TASK_KINDS = ["shoot", "edit", "report", "schedule", "link", "other"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

const tasksSchema = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: TASK_KINDS },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["kind", "title", "detail"],
      },
    },
  },
  required: ["tasks"],
};

/** 採用企画と素材から、人間がやるタスクを作る */
export async function chiefMakeTasks(account: Account, plan: Plan, materials: Partial<Materials>) {
  return generateJson<{ tasks: { kind: TaskKind; title: string; detail: string }[] }>({
    system: await loadPrompt("chief"),
    prompt: [
      `今日の日付: ${today()}`,
      `# アカウント情報\n${describeAccount(account)}`,
      `# 採用企画\n${plan.title}（${plan.post_type}）\n${plan.concept}`,
      `# 素材\n撮影リスト: ${JSON.stringify(materials.shot_list)}\n構成: ${JSON.stringify(materials.reel_structure)}`,
      `# 依頼\n人間がやるタスクを、撮影(shoot)→編集(edit)→完成報告(report)の順に3〜5件作ってください。` +
        `完成報告は「最終キャプションとサムネをアプリで完成報告する」タスクにしてください。` +
        `detail には撮影場所・時間帯・持ち物・注意点など具体的な内容を入れてください。`,
    ].join("\n\n"),
    schema: tasksSchema,
  });
}

const reviewSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean", description: "このまま予約投稿してよいか" },
    summary: { type: "string" },
    checklist: { type: "array", items: { type: "string" }, description: "予約前の確認事項" },
  },
  required: ["ok", "summary", "checklist"],
};

/** 完成報告（最終キャプション＋サムネ）をチェックする */
export async function chiefReview(input: {
  account: Account;
  plan: Plan;
  materials: Materials | null;
  finalCaption: string;
  thumbnail?: ImageInput;
}): Promise<Review> {
  return generateJson<Review>({
    system: await loadPrompt("chief"),
    prompt: [
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# 採用企画\n${input.plan.title}（${input.plan.post_type}）\n${input.plan.concept}`,
      `# AIが作った素材のキャプション\n${input.materials?.caption ?? "なし"}`,
      `# 運営者の最終キャプション\n${input.finalCaption}`,
      input.thumbnail ? "# サムネ画像\n添付の画像です。" : "# サムネ画像\n未添付",
      `# 依頼\n完成報告をチェックし、予約投稿前の確認事項を返してください。`,
    ].join("\n\n"),
    images: input.thumbnail ? [input.thumbnail] : [],
    schema: reviewSchema,
  });
}

const summarySchema = {
  type: "object",
  properties: {
    improvements: { type: "array", items: { type: "string" } },
    next_suggestions: { type: "array", items: { type: "string" } },
    message: { type: "string", description: "運営者への一言（2〜3文）" },
  },
  required: ["improvements", "next_suggestions", "message"],
};

/** 分析AIのレポートを、改善案と次の提案にまとめる */
export async function chiefSummarize(account: Account, kindLabel: string, analysis: Analysis) {
  return generateJson<ChiefSummary>({
    system: await loadPrompt("chief"),
    prompt: [
      `# アカウント情報\n${describeAccount(account)}`,
      `# 分析AIの${kindLabel}\n${JSON.stringify(analysis, null, 2)}`,
      `# 依頼\n改善案（次の投稿で具体的に変えること）と、次の企画への提案をまとめてください。`,
    ].join("\n\n"),
    schema: summarySchema,
  });
}
