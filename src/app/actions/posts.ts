"use server";
// 投稿・インサイト・分析レポート・通知に関するServer Action
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOnboardedAccount, requireUser } from "@/lib/account";
import { toErrorState, type ActionState } from "@/lib/action-state";
import { createReport, type ReportKind } from "@/lib/workflows";

// ---------- 投稿の手動登録（API連携前・連携できない時用） ----------
export async function addPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const permalink = String(formData.get("permalink") ?? "").trim();
  const postedAt = String(formData.get("posted_at") ?? "");
  const planId = String(formData.get("plan_id") ?? "") || null;
  if (!postedAt) return { error: "投稿日時を入力してください" };

  try {
    const { supabase, userId, account } = await requireOnboardedAccount();
    const { error } = await supabase.from("posts").insert({
      user_id: userId,
      account_id: account.id,
      permalink: permalink || null,
      media_type: String(formData.get("media_type") ?? "reel"),
      // 入力は日本時間として扱う
      posted_at: new Date(`${postedAt}:00+09:00`).toISOString(),
      plan_id: planId,
      link_status: planId ? "suggested" : "unlinked",
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/posts");
  return { message: "投稿を登録しました" };
}

// ---------- 投稿と企画の紐付けを確定（F-15） ----------
export async function confirmLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const postId = String(formData.get("post_id"));
  const planId = String(formData.get("plan_id") ?? "");
  if (!planId) return { error: "企画を選んでください" };

  try {
    const { supabase } = await requireUser();
    await supabase.from("posts").update({ plan_id: planId, link_status: "confirmed" }).eq("id", postId);
    await supabase.from("plans").update({ status: "posted" }).eq("id", planId).neq("status", "done");
    // 「予約投稿」「紐付け」タスクを完了にする
    await supabase
      .from("tasks")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("plan_id", planId)
      .eq("status", "todo");
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  return { message: "紐付けを確定しました" };
}

// ---------- インサイトの手入力 ----------
export async function saveInsights(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(/[,，]/g, "").trim();
    return v === "" ? null : Number(v);
  };
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("insights").insert({
      user_id: userId,
      post_id: String(formData.get("post_id")),
      source: "manual",
      likes: num("likes"),
      comments: num("comments"),
      reach: num("reach"),
      saves: num("saves"),
      shares: num("shares"),
      plays: num("plays"),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/posts");
  return { message: "数値を保存しました" };
}

// ---------- 分析レポートを今すぐ作る ----------
export async function makeReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get("kind")) as ReportKind;
  const postId = String(formData.get("post_id") ?? "") || undefined;
  let reportId: string;
  try {
    const ctx = await requireOnboardedAccount();
    reportId = await createReport(ctx, kind, postId);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  redirect(`/reports?id=${reportId}`);
}

// ---------- 通知をすべて既読にする ----------
export async function markAllRead() {
  const { supabase, userId } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  revalidatePath("/", "layout");
}
