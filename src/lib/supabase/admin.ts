// 管理者用のSupabaseクライアント（定期実行など、ログインしていない場面で使う）
// RLSを無視して全ユーザーのデータを読み書きできるので、サーバー側の処理だけで使うこと
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY が設定されていません");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
