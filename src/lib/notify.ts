// アプリ内通知を作る（メール送信はDay2で追加）
import type { SupabaseClient } from "@supabase/supabase-js";

export async function notify(
  supabase: SupabaseClient,
  userId: string,
  accountId: string, // どのアカウントの通知か
  n: { title: string; body?: string; link?: string },
) {
  await supabase.from("notifications").insert({ user_id: userId, account_id: accountId, ...n });
}
