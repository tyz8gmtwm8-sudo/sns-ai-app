import { LoginButton } from "./LoginButton";

// S-01 ログイン画面
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm text-center">
        <p className="text-3xl">📸</p>
        <h1 className="h1 mt-2">Instagram運用AI</h1>
        <p className="mt-2 text-sm text-stone-600">
          AIの編集部が、リサーチ・企画・素材づくり・分析をお手伝いします。
        </p>
        <div className="mt-6">
          <LoginButton />
        </div>
        {error && <p className="mt-4 text-sm text-red-600">ログインに失敗しました。もう一度お試しください。</p>}
      </div>
    </main>
  );
}
