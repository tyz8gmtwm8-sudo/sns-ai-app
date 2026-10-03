"use server";
// アカウント設定（ジャンル・ヒアリング・方針）に関するServer Action
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CURRENT_ACCOUNT_COOKIE, getOrCreateAccount, requireUser } from "@/lib/account";
import { runHearing } from "@/lib/agents/hearing";
import { toErrorState, type ActionState } from "@/lib/action-state";
import { GENRES } from "@/lib/constants";
import type { Policy } from "@/lib/types";

// ---------- アカウントの切り替え・追加 ----------
async function rememberAccount(accountId: string) {
  (await cookies()).set(CURRENT_ACCOUNT_COOKIE, accountId, {
    httpOnly: true, // ブラウザのJavaScriptからは読めないようにする
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1年間覚えておく
  });
}

export async function switchAccount(formData: FormData) {
  const accountId = String(formData.get("account_id"));
  const { supabase } = await requireUser();
  // 自分のアカウントか確認する（RLSにより他人のアカウントは見つからない）
  const { data } = await supabase.from("accounts").select("id").eq("id", accountId).maybeSingle();
  if (data) await rememberAccount(data.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function addAccount() {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("accounts").insert({ user_id: userId }).select("id").single();
  if (error) throw new Error(`アカウント追加に失敗しました: ${error.message}`);
  await rememberAccount(data.id);
  revalidatePath("/", "layout");
  // 新しいアカウントの初回設定（ジャンル選択→ヒアリング）へ
  redirect("/onboarding/genres");
}

// ---------- S-02 ジャンル選択 ----------
export async function saveGenres(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const genres = formData.getAll("genres").map(String).filter((g) => (GENRES as readonly string[]).includes(g));
  const genreOther = String(formData.get("genre_other") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const next = String(formData.get("next") ?? "/onboarding/hearing");

  if (genres.length === 0) return { error: "ジャンルを1つ以上選んでください" };
  if (genres.includes("その他") && !genreOther) return { error: "「その他」の内容を入力してください" };

  try {
    const { supabase, account } = await getOrCreateAccount();
    const { error } = await supabase
      .from("accounts")
      .update({ name: name || null, genres, genre_other: genres.includes("その他") ? genreOther : null, updated_at: new Date().toISOString() })
      .eq("id", account.id);
    if (error) throw new Error(error.message);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  redirect(next);
}

// ---------- S-03 AIヒアリング ----------
export type HearingState = { error?: string; policy?: Policy; done?: boolean } | null;

export async function sendHearingMessage(_prev: HearingState, formData: FormData): Promise<HearingState> {
  const text = String(formData.get("message") ?? "").trim();
  if (!text) return { error: "メッセージを入力してください" };

  try {
    const { supabase, userId, account } = await getOrCreateAccount();

    const { data: history } = await supabase
      .from("hearing_messages")
      .select("role, content")
      .eq("account_id", account.id)
      .order("created_at");

    // 今回の発言はまだ保存せず、AIに渡す会話の最後に付け足す
    const genres = account.genres.map((g) => (g === "その他" ? account.genre_other ?? g : g));
    const result = await runHearing(genres, [...(history ?? []), { role: "user", content: text }]);

    // AIの返事が成功したときだけ、発言と返事をまとめて保存する
    // （失敗したときに発言だけが残り、送り直すと二重になるのを防ぐため）
    // 並び順が入れ替わらないよう、返事の時刻を発言の1ミリ秒後にする
    const now = Date.now();
    const { error } = await supabase.from("hearing_messages").insert([
      { user_id: userId, account_id: account.id, role: "user", content: text, created_at: new Date(now).toISOString() },
      { user_id: userId, account_id: account.id, role: "assistant", content: result.reply, created_at: new Date(now + 1).toISOString() },
    ]);
    if (error) throw new Error(`会話の保存に失敗しました: ${error.message}`);

    revalidatePath("/onboarding/hearing");
    return { done: result.done, policy: result.done ? result.policy : undefined };
  } catch (e) {
    return toErrorState(e);
  }
}

/** ヒアリングをやり直す（会話履歴を消す） */
export async function resetHearing() {
  const { supabase, account } = await getOrCreateAccount();
  await supabase.from("hearing_messages").delete().eq("account_id", account.id);
  revalidatePath("/onboarding/hearing");
}

// ---------- アカウント方針の保存（S-03の最後・S-10の設定から） ----------
export async function savePolicy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const followers = get("followers");
  const policy: Policy = {
    target: get("target"),
    region: get("region"),
    purpose: get("purpose"),
    worldview: get("worldview"),
    followers: followers ? Number(followers.replace(/[,，]/g, "")) || null : null,
    post_frequency: get("post_frequency"),
    // 「@」や空白・カンマ区切りで入力された競合アカウントを配列にする
    competitors: get("competitors")
      .split(/[\s,、，]+/)
      .map((c) => c.replace(/^@/, ""))
      .filter(Boolean),
    notes: get("notes"),
  };
  const next = get("next") || "/dashboard";

  try {
    const { supabase, userId, account } = await getOrCreateAccount();
    const { error } = await supabase
      .from("accounts")
      .update({ policy, onboarded: true, updated_at: new Date().toISOString() })
      .eq("id", account.id);
    if (error) throw new Error(error.message);

    // 競合アカウント一覧を方針の内容に合わせる（一度消して入れ直す）
    await supabase.from("competitors").delete().eq("account_id", account.id);
    if (policy.competitors.length) {
      const unique = [...new Set(policy.competitors)];
      await supabase
        .from("competitors")
        .insert(unique.map((username) => ({ user_id: userId, account_id: account.id, username })));
    }
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  if (next === "stay") return { message: "保存しました" };
  redirect(next);
}
