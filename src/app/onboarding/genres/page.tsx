import { getOrCreateAccount } from "@/lib/account";
import { GenreForm } from "@/components/GenreForm";

// S-02 ジャンル選択（画面1）
export default async function GenresPage() {
  const { account } = await getOrCreateAccount();
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <p className="text-xs text-stone-500">初回設定 1/2</p>
      <h1 className="h1 mt-1">アカウントのジャンルを選んでください</h1>
      <p className="mt-2 text-sm text-stone-600">複数選べます。AIの提案内容がジャンルに合わせて変わります。</p>
      <div className="card mt-6">
        <GenreForm selected={account.genres} other={account.genre_other} next="/onboarding/hearing" />
      </div>
    </main>
  );
}
