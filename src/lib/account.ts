// ログイン中のユーザーと、「今選んでいるアカウント」を取得する共通関数
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/types";

// 今選んでいるアカウントのIDを覚えておくcookieの名前
export const CURRENT_ACCOUNT_COOKIE = "current_account_id";

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/** 自分のアカウント一覧（作った順） */
export async function listAccounts() {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase.from("accounts").select("*").eq("user_id", userId).order("created_at");
  return (data ?? []) as Account[];
}

/**
 * 今選んでいるアカウントを取得する（1つも無ければ作成する）。
 * cookieに保存したIDのアカウントが見つからなければ、最初に作ったアカウントを使う。
 */
export async function getOrCreateAccount() {
  const { supabase, userId } = await requireUser();
  const currentId = (await cookies()).get(CURRENT_ACCOUNT_COOKIE)?.value;

  const { data } = await supabase.from("accounts").select("*").eq("user_id", userId).order("created_at");
  const accounts = (data ?? []) as Account[];
  const account = accounts.find((a) => a.id === currentId) ?? accounts[0];
  if (account) return { supabase, userId, account, accounts };

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(`アカウント作成に失敗しました: ${error.message}`);
  return { supabase, userId, account: created as Account, accounts: [created as Account] };
}

/** 初回設定が終わっていなければ設定画面へ移動させる */
export async function requireOnboardedAccount() {
  const ctx = await getOrCreateAccount();
  if (!ctx.account.onboarded) {
    redirect(ctx.account.genres.length ? "/onboarding/hearing" : "/onboarding/genres");
  }
  return ctx;
}

/** 切り替えメニューなどに表示する、アカウントの呼び名 */
export function accountLabel(account: Account) {
  if (account.name) return account.name;
  if (account.ig_username) return `@${account.ig_username}`;
  const genres = account.genres.map((g) => (g === "その他" && account.genre_other ? account.genre_other : g));
  return genres.join("・") || "新しいアカウント";
}
