// 投稿作成AI：キャプション・ハッシュタグ・BGM候補・テロップを作る
import { generateJson, type ImageInput } from "@/lib/gemini";
import { loadAgentPrompt } from "@/lib/prompts";
import type { Account, Bgm, Hashtags, Materials, Plan } from "@/lib/types";
import { describeAccount } from "./context";

const schema = {
  type: "object",
  properties: {
    // 改行がないと読みにくいので、改行の入れ方も伝える
    caption: { type: "string", description: "投稿のキャプション。段落ごとに改行（\\n）と空行を入れる。ハッシュタグは含めない。" },
    hashtags: {
      type: "object",
      properties: {
        large: { type: "array", items: { type: "string" } },
        medium: { type: "array", items: { type: "string" } },
        small: { type: "array", items: { type: "string" } },
      },
      required: ["large", "medium", "small"],
    },
    bgm: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          artist: { type: "string" },
          source: { type: "string", enum: ["instagram", "free"] },
          reason: { type: "string" },
        },
        required: ["name", "artist", "source", "reason"],
      },
    },
    telops: { type: "array", items: { type: "string" } },
  },
  required: ["caption", "hashtags", "bgm", "telops"],
};

export type WriterResult = { caption: string; hashtags: Hashtags; bgm: Bgm[]; telops: string[] };

export async function runWriter(input: {
  account: Account;
  plan: Plan;
  current?: Materials | null; // 再生成時は今の内容を渡す
  ideas?: { text: string; images: ImageInput[] }; // ネタ帳
  instruction?: string;
}): Promise<WriterResult> {
  return generateJson<WriterResult>({
    system: await loadAgentPrompt("writer", input.account),
    prompt: [
      `# アカウント情報\n${describeAccount(input.account)}`,
      `# 採用企画\nタイトル: ${input.plan.title}\n投稿種類: ${input.plan.post_type}\n内容: ${input.plan.concept}`,
      input.ideas?.text ? `# ネタ帳（ここに書かれた事実を使う）\n${input.ideas.text}` : "",
      input.current ? `# 現在の素材\n${JSON.stringify({ caption: input.current.caption, hashtags: input.current.hashtags, bgm: input.current.bgm, telops: input.current.telops })}` : "",
      input.instruction ? `# 運営者からの指示（最優先で必ず反映する）\n${input.instruction}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    images: input.ideas?.images,
    schema,
  });
}
