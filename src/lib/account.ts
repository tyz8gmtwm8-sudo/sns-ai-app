// ログイン中のユーザーと、そのアカウント情報を取得する共通関数
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/** アカウントを取得（無ければ作成）する */
export async function getOrCreateAccount() {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase.from("accounts").select("*").eq("user_id", userId).maybeSingle();
  if (data) return { supabase, userId, account: data as Account };

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(`アカウント作成に失敗しました: ${error.message}`);
  return { supabase, userId, account: created as Account };
}

/** 初回設定が終わっていなければ設定画面へ移動させる */
export async function requireOnboardedAccount() {
  const ctx = await getOrCreateAccount();
  if (!ctx.account.onboarded) {
    redirect(ctx.account.genres.length ? "/onboarding/hearing" : "/onboarding/genres");
  }
  return ctx;
}
