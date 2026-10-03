import { requireOnboardedAccount } from "@/lib/account";
import { GenreForm } from "@/components/GenreForm";
import { PolicyForm } from "@/components/PolicyForm";

// S-10 設定
export default async function SettingsPage() {
  const { account } = await requireOnboardedAccount();
  return (
    <div className="space-y-6">
      <h1 className="h1">設定</h1>

      <section className="card">
        <h2 className="h2">Instagram連携</h2>
        <p className="mt-2 text-sm text-stone-600">
          {account.ig_username ? `@${account.ig_username} と連携中` : "未連携です（Instagram連携は次の開発ステップで追加します）。"}
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
        <h2 className="h2">アカウント名・ジャンル</h2>
        <div className="mt-4">
          <GenreForm name={account.name} selected={account.genres} other={account.genre_other} next="/settings" />
        </div>
      </section>
    </div>
  );
}
