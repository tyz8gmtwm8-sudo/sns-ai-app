import { requireOnboardedAccount } from "@/lib/account";
import { acceptSuggestion, addIdea, deleteIdea, review, reuseIdea, updateIdeaMemo } from "@/app/actions/ideas";
import { ActionForm } from "@/components/ActionForm";
import { CreatePostForm } from "./CreatePostForm";
import type { Idea } from "@/lib/ideas";
import { SubmitButton } from "@/components/SubmitButton";

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
  const ideas = all.filter((i) => i.status !== "suggested");
  // 最後にAIが見直した日時（提案かアドバイスのいちばん新しいもの）
  const lastReview = all.map((i) => i.advice_at).filter(Boolean).sort().at(-1);

  // 写真は非公開保存なので、一時的に見られるURL（1時間有効）を作る
  const paths = ideas.flatMap((i) => i.photo_paths);
  const { data: signed } = paths.length ? await supabase.storage.from("thumbnails").createSignedUrls(paths, 3600) : { data: [] };
  const urlOf = (path: string) => signed?.find((s) => s.path === path)?.signedUrl ?? undefined;
  const example = account.genres.map((g) => MEMO_EXAMPLES[g]).find(Boolean) ?? MEMO_EXAMPLES["グルメ"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">ネタ帳</h1>
        <p className="mt-1 text-sm text-stone-600">
          行ったお店・撮った写真・感じたことなどの<strong>事実</strong>をメモしておく場所です。
          ネタを選んで「このネタで投稿を作る」を押すと、AIがこの内容と分析の結果をもとに、企画とキャプション・動画構成を作ります。
        </p>
      </div>

      {/* 分析の結果から、次に撮るネタを提案する */}
      <section className="card space-y-3 border-emerald-200 bg-emerald-50/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">💡 AIからの提案</h2>
          {lastReview && (
            <span className="text-xs text-stone-500">
              最終更新：{new Date(lastReview).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
        </div>
        <p className="text-sm text-stone-600">
          競合分析や投稿のレポートをもとに、次に撮りに行くと伸びそうなネタを提案し、登録したネタにもアドバイスを付けます。毎週月曜にも自動で更新します。
        </p>
        {suggestions.map((s) => (
          <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="font-semibold">{s.title}</p>
            {s.advice && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{s.advice}</p>}
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
          <SubmitButton className="btn-outline">{suggestions.length ? "提案を作り直す" : "分析をもとにAIに見てもらう"}</SubmitButton>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="h2">ネタを追加</h2>
        <ActionForm action={addIdea} className="mt-3 space-y-3">
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
            <input id="photos" name="photos" type="file" accept="image/*" multiple className="text-sm" />
            <p className="mt-1 text-xs text-stone-500">写真があると、AIが「実際に撮れている素材」を見て企画を考えます。</p>
          </div>
          <SubmitButton className="btn">ネタ帳に追加</SubmitButton>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="h2">登録したネタ（{ideas.filter((i) => i.status === "unused").length}件が未使用）</h2>
        {ideas.length === 0 && <p className="text-sm text-stone-500">まだネタがありません。</p>}
        {ideas.map((idea) => (
          <div key={idea.id} className={`card flex flex-col gap-3 sm:flex-row ${idea.status === "used" ? "opacity-60" : ""}`}>
            {idea.photo_paths.length > 0 && (
              <div className="flex shrink-0 gap-1">
                {idea.photo_paths.map((p) =>
                  urlOf(p) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p} src={urlOf(p)} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  ) : null,
                )}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{idea.title}</p>
                {idea.status === "used" && <span className="badge">使用済み</span>}
              </div>
              {idea.memo ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{idea.memo}</p>
              ) : (
                <p className="mt-1 text-sm text-amber-800">メモが空です。行ったら、メニュー・価格・場所・感想などを書き足してください。</p>
              )}
              {idea.advice && idea.status === "unused" && (
                <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">💡 {idea.advice}</p>
              )}
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-stone-600 underline">メモを書き足す</summary>
                <ActionForm action={updateIdeaMemo} className="mt-2 space-y-2">
                  <input type="hidden" name="idea_id" value={idea.id} />
                  <textarea name="memo" rows={4} className="input" defaultValue={idea.memo} placeholder={example} />
                  <SubmitButton className="btn-outline px-3 py-1 text-xs">メモを保存</SubmitButton>
                </ActionForm>
              </details>
              {idea.status === "unused" && (
                <div className="mt-3">
                  <CreatePostForm ideaId={idea.id} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2 self-start">
              {idea.status === "used" && (
                <form action={reuseIdea}>
                  <input type="hidden" name="idea_id" value={idea.id} />
                  <SubmitButton className="btn-outline px-3 py-1 text-xs">もう一度使う</SubmitButton>
                </form>
              )}
              <form action={deleteIdea}>
                <input type="hidden" name="idea_id" value={idea.id} />
                <SubmitButton className="btn-outline px-3 py-1 text-xs text-red-700">削除</SubmitButton>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
