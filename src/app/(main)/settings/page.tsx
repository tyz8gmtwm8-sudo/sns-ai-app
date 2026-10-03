import { requireOnboardedAccount } from "@/lib/account";
import { saveNotifySettings, sendTestEmail } from "@/app/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { GenreForm } from "@/components/GenreForm";
import { PolicyForm } from "@/components/PolicyForm";

// S-10 設定
export default async function SettingsPage() {
  const { supabase, userId, account } = await requireOnboardedAccount();
  const { data: profile } = await supabase.from("profiles").select("email, notify_email").eq("id", userId).maybeSingle();
  const emailReady = !!process.env.RESEND_API_KEY;
  return (
    <div className="space-y-6">
      <h1 className="h1">設定</h1>

      <section className="card">
        <h2 className="h2">Instagram連携</h2>
        <p className="mt-2 text-sm text-stone-600">
          {account.ig_username ? `@${account.ig_username} と連携中` : "未連携です（Instagram連携は次の開発ステップで追加します）。"}
        </p>
        <p className="mt-2 text-sm text-stone-600">
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
