// サーバー側（Server Component / Server Action / Route Handler）で使うSupabaseクライアント
// ログイン情報はcookieに保存されているので、cookieを読み書きできるようにして作る
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Componentからはcookieを書けないので無視する
            // （proxy.ts側でセッションを更新しているので問題ない）
          }
        },
      },
    },
  );
}
