// アプリ内通知を作る（メール送信はDay2で追加）
import type { SupabaseClient } from "@supabase/supabase-js";

export async function notify(
  supabase: SupabaseClient,
  userId: string,
  n: { title: string; body?: string; link?: string },
) {
  await supabase.from("notifications").insert({ user_id: userId, ...n });
}
