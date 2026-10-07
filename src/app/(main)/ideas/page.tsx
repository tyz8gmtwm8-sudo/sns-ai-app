import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { addIdea, deleteIdea, reuseIdea } from "@/app/actions/ideas";
import { ActionForm } from "@/components/ActionForm";
import type { Idea } from "@/lib/ideas";

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
  const ideas = (data ?? []) as Idea[];

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
          企画を作るときにネタを選ぶと、AIがこの内容をもとに企画とキャプションを作ります（想像で作らなくなります）。
        </p>
      </div>

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
          <button className="btn">ネタ帳に追加</button>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="h2">登録したネタ（{ideas.filter((i) => i.status === "unused").length}件が未使用）</h2>
          <Link href="/plans" className="text-sm underline">このネタで企画を作る →</Link>
        </div>
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
              {idea.memo && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{idea.memo}</p>}
            </div>
            <div className="flex shrink-0 gap-2 self-start">
              {idea.status === "used" && (
                <form action={reuseIdea}>
                  <input type="hidden" name="idea_id" value={idea.id} />
                  <button className="btn-outline px-3 py-1 text-xs">もう一度使う</button>
                </form>
              )}
              <form action={deleteIdea}>
                <input type="hidden" name="idea_id" value={idea.id} />
                <button className="btn-outline px-3 py-1 text-xs text-red-700">削除</button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
