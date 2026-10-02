// AIヒアリング：チャットでアカウント方針を聞き取る
import { generateJson } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";
import type { Policy } from "@/lib/types";

const policySchema = {
  type: "object",
  properties: {
    target: { type: "string" },
    region: { type: "string" },
    purpose: { type: "string" },
    worldview: { type: "string" },
    followers: { type: ["integer", "null"] },
    post_frequency: { type: "string" },
    competitors: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: ["target", "region", "purpose", "worldview", "followers", "post_frequency", "competitors", "notes"],
};

const schema = {
  type: "object",
  properties: {
    reply: { type: "string", description: "運営者への次の発言" },
    done: { type: "boolean", description: "全項目を聞き終えたか" },
    policy: { ...policySchema, description: "done が false の間は分かった範囲で埋め、不明な項目は空文字・null・空配列にする" },
  },
  required: ["reply", "done", "policy"],
};

export type HearingResult = { reply: string; done: boolean; policy: Policy };

export async function runHearing(
  genres: string[],
  history: { role: "user" | "assistant"; content: string }[],
): Promise<HearingResult> {
  const conversation = history
    .map((m) => `${m.role === "user" ? "運営者" : "あなた"}: ${m.content}`)
    .join("\n");
  return generateJson<HearingResult>({
    system: await loadPrompt("hearing"),
    prompt: `選択済みジャンル: ${genres.join("、")}\n\n# これまでの会話\n${conversation || "（まだ会話はありません。挨拶して最初の質問をしてください）"}`,
    schema,
  });
}
