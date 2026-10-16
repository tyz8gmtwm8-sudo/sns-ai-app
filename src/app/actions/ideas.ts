"use server";
// ネタ帳に関するServer Action
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedAccount } from "@/lib/account";
import { toErrorState, type ActionState } from "@/lib/action-state";
import { createPostFromIdea, reviewIdeas } from "@/lib/workflows";

const MAX_PHOTOS = 3;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024; // サーバーへ送れる上限(4MB)より少し小さく

/** ネタを追加する（写真も保存する） */
export async function addIdea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = String(formData.get("title") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title) return { error: "タイトル（お店の名前やテーマ）を入力してください" };
  if (photos.length > MAX_PHOTOS) return { error: `写真は${MAX_PHOTOS}枚までにしてください` };
  if (photos.some((f) => !f.type.startsWith("image/"))) return { error: "写真は画像ファイルを選んでください" };
  if (photos.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) {
    return { error: "写真の合計サイズは3.5MBまでです。枚数を減らすか、小さい画像にしてください" };
  }

  try {
    const { supabase, userId, account } = await requireOnboardedAccount();
    // 写真は非公開の保存場所に「ユーザーID/ideas/…」の形で保存する（本人だけが見られる）
    const photoPaths: string[] = [];
    for (const [i, f] of photos.entries()) {
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${userId}/ideas/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage
        .from("thumbnails")
        .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
      if (error) throw new Error(`写真の保存に失敗しました: ${error.message}`);
      photoPaths.push(path);
    }
    const { error } = await supabase
      .from("ideas")
      .insert({ user_id: userId, account_id: account.id, title, memo, photo_paths: photoPaths });
    if (error) throw new Error(error.message);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/ideas");
  revalidatePath("/plans");
  return { message: "ネタ帳に追加しました" };
}

/** ネタを削除する（写真も消す） */
export async function deleteIdea(formData: FormData) {
  const id = String(formData.get("idea_id"));
  const { supabase, account } = await requireOnboardedAccount();
  const { data } = await supabase.from("ideas").select("photo_paths").eq("id", id).eq("account_id", account.id).maybeSingle();
  if (!data) return;
  if (data.photo_paths?.length) await supabase.storage.from("thumbnails").remove(data.photo_paths);
  await supabase.from("ideas").delete().eq("id", id);
  revalidatePath("/ideas");
  revalidatePath("/plans");
}

/** 使用済みのネタを、もう一度使えるように戻す */
export async function reuseIdea(formData: FormData) {
  const id = String(formData.get("idea_id"));
  const { supabase, account } = await requireOnboardedAccount();
  await supabase.from("ideas").update({ status: "unused" }).eq("id", id).eq("account_id", account.id);
  revalidatePath("/ideas");
  revalidatePath("/plans");
}

/** このネタで投稿を作る（企画1件と、キャプション・動画構成などの素材をまとめて作る） */
export async function createFromIdea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ideaId = String(formData.get("idea_id"));
  const instruction = String(formData.get("instruction") ?? "").trim() || undefined;
  let planId: string;
  try {
    const ctx = await requireOnboardedAccount();
    planId = await createPostFromIdea(ctx, ideaId, instruction);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  redirect(`/plans/${planId}/materials`);
}

/** 分析をもとに、AIにネタ帳を見直してもらう（次に撮るネタの提案・ネタごとのアドバイス） */
export async function review(): Promise<ActionState> {
  try {
    const ctx = await requireOnboardedAccount();
    await reviewIdeas(ctx);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/ideas");
  return { message: "AIの提案とアドバイスを更新しました" };
}

/** AIからの提案を、ネタ帳に追加する（実際に行ったら、メモと写真を足してもらう） */
export async function acceptSuggestion(formData: FormData) {
  const id = String(formData.get("idea_id"));
  const { supabase, account } = await requireOnboardedAccount();
  await supabase.from("ideas").update({ status: "unused" }).eq("id", id).eq("account_id", account.id).eq("status", "suggested");
  revalidatePath("/ideas");
}

/** 登録したネタのメモを書き足す（AIの提案から追加したネタに、行ったあとの事実を足すため） */
export async function updateIdeaMemo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("idea_id"));
  const memo = String(formData.get("memo") ?? "").trim();
  try {
    const { supabase, account } = await requireOnboardedAccount();
    const { error } = await supabase.from("ideas").update({ memo }).eq("id", id).eq("account_id", account.id);
    if (error) throw new Error(error.message);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/ideas");
  return { message: "メモを保存しました" };
}
