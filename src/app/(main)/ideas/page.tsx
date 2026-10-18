import { requireOnboardedAccount } from "@/lib/account";
import { acceptSuggestion, addIdea, deleteIdea, review, reuseIdea, updateIdeaMemo } from "@/app/actions/ideas";
import { ActionForm } from "@/components/ActionForm";
import { CreatePostForm } from "./CreatePostForm";
import type { Idea } from "@/lib/ideas";
import { SubmitButton } from "@/components/SubmitButton";
import { FileDrop } from "@/components/FileDrop";

// ジャンルごとの、メモの書き方の例
const MEMO_EXAMPLES: Record<string, string> = {
  グルメ: "例：梅田駅から徒歩5分。チーズバーガー1,600円。11時〜21時、水曜定休。肉汁がすごくてバンズがふわふわ。平日12時でも並ばず入れた。",
  ファッション: "例：ユニクロのスフレヤーンニット（3,990円）。身長158cmでMサイズ。ベージュとグレーの2色を着回し。",
  vlog: "例：朝5時起きでカフェ作業→昼にジム→夜は友だちとごはん。最近フリーランス1年目で不安なことが多い。",
  旅行: "例：京都・嵐山。朝7時の竹林は人が少ない。交通費と食事で1日1万円くらい。",
};

// ネタ帳：行ったお店・撮った素材・感想などの「事実」をメモしておく
export default async function IdeasPage() {
  const { supabase, account } = await requireOnboardedAccount();
  const { data } = await supabase.from("ideas").select("*").eq("account_id", account.id).order("created_at", { ascending: false });
  const all = (data ?? []) as Idea[];
  const suggestions = all.filter((i) => i.status === "suggested");
  const unused = all.filter((i) => i.status === "unused");
  const used = all.filter((i) => i.status === "used");
  // 最後にAIが見直した日時（提案かアドバイスのいちばん新しいもの）
  const lastReview = all.map((i) => i.advice_at).filter(Boolean).sort().at(-1);

  // 写真は非公開保存なので、一時的に見られるURL（1時間有効）を作る
  const paths = [...unused, ...used].flatMap((i) => i.photo_paths);
  const { data: signed } = paths.length ? await supabase.storage.from("thumbnails").createSignedUrls(paths, 3600) : { data: [] };
  const urlOf = (path: string) => signed?.find((s) => s.path === path)?.signedUrl ?? undefined;
  const example = account.genres.map((g) => MEMO_EXAMPLES[g]).find(Boolean) ?? MEMO_EXAMPLES["グルメ"];

  return (
    <div className="space-y-6">
      {/* ---------- 見出しと「ネタを追加」 ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">① ネタ帳</h1>
          <p className="mt-1 text-sm text-stone-600">
            行ったお店や撮った写真の<strong>事実</strong>をメモして、「このネタで投稿を作る」で投稿づくりを始めます。
          </p>
        </div>
      </div>

      <details className="card group" open={unused.length === 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="h2">＋ ネタを追加</span>
          <span className="text-sm text-stone-500 group-open:hidden">開く ▼</span>
          <span className="hidden text-sm text-stone-500 group-open:inline">閉じる ▲</span>
        </summary>
        <ActionForm action={addIdea} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="title">タイトル（お店の名前やテーマ）</label>
            <input id="title" name="title" className="input" placeholder="例：〇〇バーガー 梅田店" required />
          </div>
          <div>
            <label className="label" htmlFor="memo">メモ（事実と感想。くわしいほどAIの精度が上がります）</label>
            <textarea id="memo" name="memo" rows={4} className="input" placeholder={example} />
          </div>
          <div>
            <label className="label" htmlFor="photos">撮った写真（任意・3枚・合計3.5MBまで）</label>
            <FileDrop id="photos" name="photos" multiple hint="3枚・合計3.5MBまで" />
            <p className="mt-1 text-xs text-stone-500">写真があると、AIが「実際に撮れている素材」を見て企画を考えます。</p>
          </div>
          <SubmitButton className="btn">ネタ帳に追加</SubmitButton>
        </ActionForm>
      </details>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ---------- 左：登録したネタ ---------- */}
        <div className="space-y-4">
          <h2 className="h2">未使用のネタ（{unused.length}件）</h2>
          {unused.length === 0 && (
            <p className="card text-sm text-stone-500">未使用のネタはありません。「＋ ネタを追加」か、右の「AIからの提案」から追加しましょう。</p>
          )}
          {unused.map((idea) => (
            <article key={idea.id} className="card space-y-3">
              <div className="flex items-start gap-3">
                {idea.photo_paths.length > 0 && (
                  <div className="flex shrink-0 gap-1">
                    {idea.photo_paths.map((p) =>
                      urlOf(p) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={p} src={urlOf(p)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ) : null,
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{idea.title}</h3>
                  {idea.memo ? (
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-stone-600">{idea.memo}</p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-800">メモが空です。行ったら「メモを編集」から、メニュー・価格・場所・感想などを書き足してください。</p>
                  )}
                </div>
              </div>

              {idea.advice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">💡 {idea.advice}</p>}

              <CreatePostForm ideaId={idea.id} />

              {/* あまり使わない操作は、小さくまとめる */}
              <div className="flex flex-wrap items-start gap-4 border-t border-stone-100 pt-3 text-sm">
                <details className="flex-1">
                  <summary className="cursor-pointer text-stone-600 hover:text-stone-900">📝 メモを編集</summary>
                  <ActionForm action={updateIdeaMemo} className="mt-2 space-y-2">
                    <input type="hidden" name="idea_id" value={idea.id} />
                    <textarea name="memo" rows={5} className="input" defaultValue={idea.memo} placeholder={example} />
                    <SubmitButton className="btn-outline px-3 py-1 text-xs">メモを保存</SubmitButton>
                  </ActionForm>
                </details>
                <form action={deleteIdea}>
                  <input type="hidden" name="idea_id" value={idea.id} />
                  <SubmitButton className="flex items-center gap-1 text-red-700 hover:underline">削除</SubmitButton>
                </form>
              </div>
            </article>
          ))}

          {used.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer font-semibold text-stone-700">使用済みのネタ（{used.length}件）</summary>
              <ul className="mt-3 divide-y divide-stone-100">
                {used.map((idea) => (
                  <li key={idea.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1 text-stone-600">{idea.title}</span>
                    <form action={reuseIdea}>
                      <input type="hidden" name="idea_id" value={idea.id} />
                      <SubmitButton className="btn-outline px-3 py-1 text-xs">もう一度使う</SubmitButton>
                    </form>
                    <form action={deleteIdea}>
                      <input type="hidden" name="idea_id" value={idea.id} />
                      <SubmitButton className="flex items-center gap-1 text-xs text-red-700 hover:underline">削除</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* ---------- 右：AIからの提案（パソコンでは画面を下げても付いてくる） ---------- */}
        <aside className="card space-y-3 border-emerald-200 bg-emerald-50/40 lg:sticky lg:top-6">
          <h2 className="h2">💡 AIからの提案</h2>
          <p className="text-xs text-stone-600">
            分析の結果から、次に撮りに行くと伸びそうなネタです。毎週月曜に自動で更新します。
          </p>
          {lastReview && (
            <p className="text-xs text-stone-500">
              最終更新：{new Date(lastReview).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="font-semibold">{s.title}</p>
              {s.advice && <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">{s.advice}</p>}
              <div className="mt-2 flex gap-2">
                <form action={acceptSuggestion}>
                  <input type="hidden" name="idea_id" value={s.id} />
                  <SubmitButton className="btn-outline px-3 py-1 text-xs">ネタ帳に追加</SubmitButton>
                </form>
                <form action={deleteIdea}>
                  <input type="hidden" name="idea_id" value={s.id} />
                  <SubmitButton className="btn-outline px-3 py-1 text-xs text-stone-500">いらない</SubmitButton>
                </form>
              </div>
            </div>
          ))}
          <ActionForm action={review} progressSteps={["企画AIが分析の結果を読んでいます…", "企画AIがネタ帳を見直しています…", "もう少しです…"]}>
            <SubmitButton className="btn-outline w-full">{suggestions.length ? "提案を作り直す" : "分析をもとにAIに見てもらう"}</SubmitButton>
          </ActionForm>
        </aside>
      </div>
    </div>
  );
}
