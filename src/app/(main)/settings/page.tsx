import { requireOnboardedAccount } from "@/lib/account";
import { saveNotifySettings, sendTestEmail } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { disconnectInstagram } from "@/app/actions/instagram";
import { getConnection } from "@/lib/instagram/sync";
import { GenreForm } from "@/components/GenreForm";
import { PolicyForm } from "@/components/PolicyForm";

// S-10 設定
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { ig_error } = await searchParams;
  const { supabase, userId, account } = await requireOnboardedAccount();
  const { data: profile } = await supabase.from("profiles").select("email, notify_email").eq("id", userId).maybeSingle();
  const emailReady = !!process.env.RESEND_API_KEY;
  const igReady = !!(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.TOKEN_ENCRYPTION_KEY);
  const conn = await getConnection(supabase, account.id);
  return (
    <div className="space-y-6">
      <h1 className="h1">設定</h1>

      <section className="card">
        <h2 className="h2">Instagram連携</h2>
        {ig_error && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">⚠️ {ig_error}</p>}
        {!igReady ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Meta開発者アプリの設定（META_APP_ID など）がまだのため、連携できません。
          </p>
        ) : conn ? (
          <div className="mt-2 space-y-2 text-sm">
            <p>
              <span className="font-semibold">@{conn.ig_username}</span>（Facebookページ：{conn.page_name}）と連携中
              {conn.status === "error" && <span className="ml-2 badge bg-red-100 text-red-800">連携エラー</span>}
            </p>
            {conn.last_synced_at && (
              <p className="text-xs text-stone-500">
                最終取得：{new Date(conn.last_synced_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（毎日自動で取得します）
              </p>
            )}
            {conn.status === "error" && <p className="text-xs text-red-700">{conn.last_error}</p>}
            <div className="flex flex-wrap gap-2">
              <a href="/api/instagram/connect" className="btn-outline">{conn.status === "error" ? "再連携する" : "連携し直す"}</a>
              <form action={disconnectInstagram}>
                <button className="btn-outline text-red-700">連携を解除</button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-stone-600">
            <p>連携すると、投稿とインサイトを毎日自動で取得し、競合分析もできるようになります。</p>
            <a href="/api/instagram/connect" className="btn">Instagramと連携する</a>
          </div>
        )}
        <p className="mt-3 text-sm text-stone-600">
          連携が使えないときは、インサイト画面の
          <a href="/posts#screenshot" className="mx-1 underline">スクショから数値を取り込めます</a>。
        </p>
      </section>

      <section className="card">
        <h2 className="h2">アカウント方針・競合アカウント</h2>
        <div className="mt-4">
          <PolicyForm policy={account.policy} next="stay" submitLabel="保存する" />
        </div>
        <p className="mt-3 text-xs text-stone-500">
          AIと話しながら決め直したいときは <a href="/onboarding/hearing" className="underline">AIヒアリング</a> へ。
        </p>
      </section>

      <section className="card">
        <h2 className="h2">通知</h2>
        <p className="mt-2 text-sm text-stone-600">
          素材やレポートの完成、タスクの追加を、アプリ内とメール（{profile?.email ?? "未登録"}）でお知らせします。
          すべてのアカウントの通知が、このアドレスに届きます。
        </p>
        {!emailReady && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            メール送信の設定（RESEND_API_KEY）がまだのため、今はアプリ内通知だけが届きます。
          </p>
        )}
        <ActionForm action={saveNotifySettings} className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify_email" defaultChecked={profile?.notify_email ?? true} />
            メールでも通知を受け取る
          </label>
          <button className="btn-outline">保存</button>
        </ActionForm>
        <ActionForm action={sendTestEmail} className="mt-3">
          <button className="btn-outline" disabled={!emailReady}>テストメールを送る</button>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="h2">アカウント名・ジャンル</h2>
        <div className="mt-4">
          <GenreForm name={account.name} selected={account.genres} other={account.genre_other} next="/settings" />
        </div>
      </section>
    </div>
  );
}
