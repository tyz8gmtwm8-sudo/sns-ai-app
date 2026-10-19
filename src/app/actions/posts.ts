"use server";
// 投稿・インサイト・分析レポート・通知に関するServer Action
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOnboardedAccount, requireUser } from "@/lib/account";
import { toErrorState, type ActionState } from "@/lib/action-state";
import { createReport, type ReportKind, REPORT_KINDS } from "@/lib/workflows";
import { readInsightScreenshots } from "@/lib/agents/screenshot";
import type { ImageInput } from "@/lib/gemini";

// 企画が、すでに別の投稿と紐付け確定済みかどうか調べる
// （画面の選択肢からは外しているが、別のタブで同時に操作したときなどの二重紐付けを防ぐ）
const DUPLICATE_LINK_ERROR = "この企画はすでに別の投稿と紐付いています。画面を読み込み直して、別の企画を選んでください";

async function isPlanLinkedToOtherPost(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  planId: string,
  postId?: string,
) {
  let query = supabase.from("posts").select("id").eq("plan_id", planId).eq("link_status", "confirmed").limit(1);
  if (postId) query = query.neq("id", postId); // 自分自身の投稿は除く
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

// ---------- 投稿の手動登録（API連携前・連携できない時用） ----------
export async function addPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const permalink = String(formData.get("permalink") ?? "").trim();
  const postedAt = String(formData.get("posted_at") ?? "");
  const planId = String(formData.get("plan_id") ?? "") || null;
  if (!postedAt) return { error: "投稿日時を入力してください" };

  try {
    const { supabase, userId, account } = await requireOnboardedAccount();
    if (planId && (await isPlanLinkedToOtherPost(supabase, planId))) return { error: DUPLICATE_LINK_ERROR };
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
    if (await isPlanLinkedToOtherPost(supabase, planId, postId)) return { error: DUPLICATE_LINK_ERROR };
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

// ---------- スクショから数値を読み取る（F-06） ----------
const MAX_SCREENSHOTS = 3;
const MAX_TOTAL_BYTES = 3.5 * 1024 * 1024; // サーバーへ送れる上限(4MB)より少し小さく

export async function readScreenshot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const target = String(formData.get("post_id") ?? ""); // 投稿のID、または "new"
  const files = formData.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);

  if (!target) return { error: "どの投稿の数値か選んでください" };
  if (files.length === 0) return { error: "スクショを選んでください" };
  if (files.length > MAX_SCREENSHOTS) return { error: `スクショは${MAX_SCREENSHOTS}枚までにしてください` };
  if (files.some((f) => !f.type.startsWith("image/"))) return { error: "画像ファイルを選んでください" };
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) {
    return { error: "画像の合計サイズは3.5MBまでです。枚数を減らすか、小さい画像にしてください" };
  }

  try {
    const { supabase, userId, account } = await requireOnboardedAccount();

    // 画像をAIに渡せる形（base64という文字列）に変換して読み取る
    const images: ImageInput[] = await Promise.all(
      files.map(async (f) => ({ mimeType: f.type, base64: Buffer.from(await f.arrayBuffer()).toString("base64") })),
    );
    const r = await readInsightScreenshots(images);
    const values = [r.likes, r.comments, r.reach, r.saves, r.shares, r.plays];
    if (values.every((v) => v === null)) {
      return { error: `数値を読み取れませんでした。${r.note || "インサイト画面のスクショか確認してください。"}` };
    }

    // 「新しい投稿として登録」の場合は、投稿も作る
    let postId = target;
    if (target === "new") {
      const postedAt = r.posted_at && !isNaN(Date.parse(r.posted_at)) ? new Date(r.posted_at).toISOString() : new Date().toISOString();
      const { data, error } = await supabase
        .from("posts")
        .insert({ user_id: userId, account_id: account.id, media_type: r.media_type || "reel", posted_at: postedAt })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      postId = data.id;
    } else {
      // 今のアカウントの投稿か確認する
      const { data } = await supabase.from("posts").select("id").eq("id", target).eq("account_id", account.id).maybeSingle();
      if (!data) return { error: "投稿が見つかりません。画面を再読み込みしてください" };
    }

    const { error } = await supabase.from("insights").insert({
      user_id: userId,
      post_id: postId,
      source: "screenshot",
      likes: r.likes,
      comments: r.comments,
      reach: r.reach,
      saves: r.saves,
      shares: r.shares,
      plays: r.plays,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/posts");
    const show = (label: string, v: number | null) => `${label}${v ?? "-"}`;
    return {
      message:
        `読み取って保存しました：${show("いいね", r.likes)}・${show("コメント", r.comments)}・${show("リーチ", r.reach)}・` +
        `${show("保存", r.saves)}・${show("シェア", r.shares)}・${show("再生", r.plays)}` +
        (r.note ? `（AIのメモ：${r.note}）` : "") +
        "　数字が違う場合は、投稿の「数値」から手で直してください。",
    };
  } catch (e) {
    return toErrorState(e);
  }
}

// ---------- 分析レポートを今すぐ作る ----------
export async function makeReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get("kind")) as ReportKind;
  const postId = String(formData.get("post_id") ?? "") || undefined;
  // 作れるのは7日後レポートと週次レポートだけ
  if (!REPORT_KINDS.includes(kind)) return { error: "このレポートは作れません" };
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
  const { supabase, account } = await requireOnboardedAccount();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("account_id", account.id).is("read_at", null);
  revalidatePath("/", "layout");
}
