// 動画構成AI：リールのカット割りと撮影リストを作る
import { generateJson, type ImageInput } from "@/lib/gemini";
import { loadAgentPrompt } from "@/lib/prompts";
import type { Account, Cut, Materials, Plan } from "@/lib/types";
import { describeAccount } from "./context";

const schema = {
  type: "object",
  properties: {
    reel_structure: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "integer" },
          end: { type: "integer" },
          scene: { type: "string" },
          shot: { type: "string" },
          telop: { type: "string" },
        },
        required: ["start", "end", "scene", "shot", "telop"],
      },
    },
    shot_list: { type: "array", items: { type: "string" } },
  },
  required: ["reel_structure", "shot_list"],
};

export type VideoResult = { reel_structure: Cut[]; shot_list: string[] };

export async function runVideo(input: {
  account: Account;
  plan: Plan;
  current?: Materials | null;
  ideas?: { text: string; images: ImageInput[] }; // ネタ帳
  instruction?: string;
}): Promise<VideoResult> {
  return generateJson<VideoResult>({
    system: await loadAgentPrompt("video", input.account),
    prompt: [
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# 採用企画\nタイトル: ${input.plan.title}\n投稿種類: ${input.plan.post_type}\n内容: ${input.plan.concept}`,
      input.ideas?.text ? `# ネタ帳（ここに書かれた事実を使う）\n${input.ideas.text}` : "",
      input.current ? `# 現在の構成\n${JSON.stringify({ reel_structure: input.current.reel_structure, shot_list: input.current.shot_list })}` : "",
      input.instruction ? `# 運営者からの指示（最優先で必ず反映する）\n${input.instruction}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    images: input.ideas?.images,
    schema,
  });
}
