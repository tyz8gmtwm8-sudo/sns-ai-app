// 動画構成AI：リールのカット割りと撮影リストを作る
import { generateJson } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";
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
  instruction?: string;
}): Promise<VideoResult> {
  return generateJson<VideoResult>({
    system: await loadPrompt("video"),
    prompt: [
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# 採用企画\nタイトル: ${input.plan.title}\n投稿種類: ${input.plan.post_type}\n内容: ${input.plan.concept}`,
      input.current ? `# 現在の構成\n${JSON.stringify({ reel_structure: input.current.reel_structure, shot_list: input.current.shot_list })}` : "",
      input.instruction ? `# 運営者からの修正指示\n${input.instruction}` : "",
    ].join("\n\n"),
    schema,
  });
}
