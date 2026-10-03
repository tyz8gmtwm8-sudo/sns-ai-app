// スクショ読み取り：インサイト画面の画像から数値を読み取る（F-06）
import { generateJson, type ImageInput } from "@/lib/gemini";
import { loadPrompt } from "@/lib/prompts";

const nullableInt = { type: ["integer", "null"] };

const schema = {
  type: "object",
  properties: {
    likes: nullableInt,
    comments: nullableInt,
    shares: nullableInt,
    saves: nullableInt,
    reach: nullableInt,
    plays: nullableInt,
    posted_at: { type: "string", description: "投稿日時（ISO 8601）。分からなければ空文字" },
    media_type: { type: "string", enum: ["reel", "carousel", "image", ""] },
    note: { type: "string", description: "読み取りの注意点。無ければ空文字" },
  },
  required: ["likes", "comments", "shares", "saves", "reach", "plays", "posted_at", "media_type", "note"],
};

export type ScreenshotResult = {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  plays: number | null;
  posted_at: string;
  media_type: "reel" | "carousel" | "image" | "";
  note: string;
};

export async function readInsightScreenshots(images: ImageInput[]): Promise<ScreenshotResult> {
  return generateJson<ScreenshotResult>({
    system: await loadPrompt("screenshot"),
    prompt: `今日の日付: ${new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}\n添付のスクリーンショット（${images.length}枚）から数値を読み取ってください。`,
    images,
    schema,
  });
}
