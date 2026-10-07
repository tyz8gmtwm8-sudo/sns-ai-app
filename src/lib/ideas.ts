// ネタ帳：AIに渡すために、ネタの文章と写真を読み込む
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageInput } from "@/lib/gemini";

export type Idea = {
  id: string;
  title: string;
  memo: string;
  photo_paths: string[];
  status: "unused" | "used";
  created_at: string;
};

// AIに渡す写真の上限（多すぎると時間とAIの利用量が増えるため）
const MAX_IMAGES = 6;

/** 選ばれたネタを「AIに渡す文章」と「写真」にまとめる */
export async function loadIdeasForAI(supabase: SupabaseClient, ideaIds: string[], { withPhotos = true } = {}) {
  if (!ideaIds.length) return { text: "", images: [] as ImageInput[] };

  const { data } = await supabase.from("ideas").select("*").in("id", ideaIds);
  const ideas = (data ?? []) as Idea[];

  const text = ideas
    .map((idea, i) => `## ネタ${i + 1}：${idea.title}\n${idea.memo || "（メモなし）"}${idea.photo_paths.length ? `\n（写真${idea.photo_paths.length}枚を添付）` : ""}`)
    .join("\n\n");

  const images: ImageInput[] = [];
  if (withPhotos) {
    for (const path of ideas.flatMap((idea) => idea.photo_paths).slice(0, MAX_IMAGES)) {
      const { data: file } = await supabase.storage.from("thumbnails").download(path);
      if (!file) continue;
      images.push({ mimeType: file.type || "image/jpeg", base64: Buffer.from(await file.arrayBuffer()).toString("base64") });
    }
  }
  return { text, images };
}
