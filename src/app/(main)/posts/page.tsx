import { requireOnboardedAccount } from "@/lib/account";
import { addPost, confirmLink, makeReport, readScreenshot, saveInsights } from "@/app/actions/posts";
import { ActionForm } from "@/components/ActionForm";
import { POST_TYPE_LABELS } from "@/lib/constants";
import { syncNow } from "@/app/actions/instagram";
import { getConnection } from "@/lib/instagram/sync";
import { SubmitButton } from "@/components/SubmitButton";
import { FileDrop } from "@/components/FileDrop";
import { Tabs } from "@/components/Tabs";

type Insight = { likes: number | null; comments: number | null; reach: number | null; saves: number | null; shares: number | null; plays: number | null; captured_at: string; source: string };
type PostRow = {
  id: string;
  media_type: string | null;
  permalink: string | null;
  caption: string | null;
  posted_at: string | null;
  plan_id: string | null;
  link_status: string;
  thumbnail_url: string | null;
  insights: Insight[];
};

const REPORT_STEPS = ["分析AIが数値を読み解いています…", "編集長AIが改善案をまとめています…", "もう少しです…"];
const fmt = (d: string) => new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });

// S-08 投稿の紐付け（＋数値の手入力）
export default async function PostsPage() {
  const { supabase, account } = await requireOnboardedAccount();
  const [{ data: postsData }, { data: plans }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, media_type, permalink, caption, posted_at, plan_id, link_status, thumbnail_url, insights(likes, comments, reach, saves, shares, plays, captured_at, source)")
      .eq("account_id", account.id)
      .order("posted_at", { ascending: false })
      .limit(30),
    supabase.from("plans").select("id, title, status").eq("account_id", account.id).in("status", ["materials_ready", "reported", "posted", "done"]).order("created_at", { ascending: false }),
  ]);
  const posts = (postsData ?? []) as PostRow[];
  const conn = await getConnection(supabase, account.id);
  const planTitle = (id: string | null) => plans?.find((p) => p.id === id)?.title;

  const planSelect = (defaultValue?: string | null) => (
    <select name="plan_id" className="input" defaultValue={defaultValue ?? ""}>
      <option value="">企画を選ぶ</option>
      {plans?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select>
  );

  // 投稿1件分のカード
  const postCard = (post: PostRow) => {
    const latest = [...post.insights].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
    // 数値は小さな枠で並べる（リール以外は再生数が無いので出さない）
    const metrics = [
      { label: "いいね", value: latest?.likes },
      { label: "保存", value: latest?.saves },
      { label: "リーチ", value: latest?.reach },
      ...(post.media_type === "reel" ? [{ label: "再生", value: latest?.plays }] : [{ label: "コメント", value: latest?.comments }]),
    ];
    return (
      <article key={post.id} className="card space-y-4">
        <div className="flex gap-3">
          {post.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnail_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xl" aria-hidden>📷</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
              <span>{POST_TYPE_LABELS[post.media_type ?? ""] ?? post.media_type}</span>
              {post.posted_at && <span>· {fmt(post.posted_at)}</span>}
              {post.permalink && (
                <a href={post.permalink} target="_blank" rel="noreferrer" className="ml-auto underline">Instagramで見る ↗</a>
              )}
            </div>
            {post.caption && <p className="mt-1 line-clamp-1 text-sm">{post.caption}</p>}
            {post.link_status === "confirmed" && (
              <p className="mt-1 text-xs text-emerald-800">✓ 企画：{planTitle(post.plan_id) ?? "（削除された企画）"}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg bg-stone-50 px-2 py-2 text-center">
              <p className="text-[11px] text-stone-500">{m.label}</p>
              <p className="text-lg font-bold">{m.value ?? "-"}</p>
            </div>
          ))}
        </div>
        {latest && <p className="-mt-2 text-right text-[11px] text-stone-400">{fmt(latest.captured_at)}時点</p>}

        {post.link_status !== "confirmed" && (
          <ActionForm action={confirmLink} className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 sm:flex-row sm:items-center">
            <input type="hidden" name="post_id" value={post.id} />
            <span className="shrink-0 text-sm text-amber-900">
              ⚠️ {post.link_status === "suggested" ? "この企画の投稿ですか？" : "どの企画の投稿？"}
            </span>
            {planSelect(post.plan_id)}
            <SubmitButton className="btn shrink-0">確定</SubmitButton>
          </ActionForm>
        )}

        {/* あまり使わない操作は、まとめて閉じておく */}
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-600 hover:text-stone-900">そのほかの操作（数値の編集・レポート）</summary>
          <div className="mt-3 space-y-3">
            <ActionForm action={saveInsights} className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              <input type="hidden" name="post_id" value={post.id} />
              {[["likes", "いいね"], ["comments", "コメント"], ["reach", "リーチ"], ["saves", "保存"], ["shares", "シェア"], ["plays", "再生数"]].map(([k, l]) => (
                <div key={k}>
                  <label className="label">{l}</label>
                  <input name={k} inputMode="numeric" className="input" defaultValue={latest?.[k as keyof Insight] ?? ""} />
                </div>
              ))}
              <div className="flex items-end"><SubmitButton className="btn-outline w-full">保存</SubmitButton></div>
            </ActionForm>
            <div className="flex flex-wrap gap-2">
              {([["post_7d", "7日後レポート"]] as const).map(([kind, label]) => (
                <ActionForm key={kind} action={makeReport} progressSteps={REPORT_STEPS}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="post_id" value={post.id} />
                  <SubmitButton className="btn-outline text-xs" disabled={!latest}>{label}を作る</SubmitButton>
                </ActionForm>
              ))}
            </div>
          </div>
        </details>
      </article>
    );
  };

  const needLink = posts.filter((p) => p.link_status !== "confirmed");
  const postGrid = (list: PostRow[], empty: string) =>
    list.length ? <div className="grid gap-4 xl:grid-cols-2">{list.map(postCard)}</div> : <p className="card text-sm text-stone-600">{empty}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">③ 投稿</h1>
          <p className="mt-1 text-sm text-stone-600">
            {conn ? (
              <>@{conn.ig_username} と連携中です。投稿と数値は毎朝自動で取得し、完成報告のキャプションと比べて企画との紐付け候補を出します。</>
            ) : (
              <>Instagram未連携です。<a href="/settings" className="underline">設定</a>から連携すると、投稿と数値を自動で取得します。</>
            )}
          </p>
        </div>
        {conn && (
          <ActionForm action={syncNow} progressSteps={["Instagramから投稿とインサイトを取得しています…", "紐付け候補を探しています…"]}>
            <SubmitButton className="btn">Instagramから今すぐ取得</SubmitButton>
          </ActionForm>
        )}
      </div>

      <Tabs
        tabs={[
          { key: "need", label: `紐付けが必要（${needLink.length}）`, content: postGrid(needLink, "紐付けが必要な投稿はありません。") },
          { key: "all", label: `すべての投稿（${posts.length}）`, content: postGrid(posts, "まだ投稿がありません。") },
        ]}
      />

      {/* 手入力とスクショ読み取り（連携していないときは、最初から開いておく） */}
      <details id="screenshot" className="card scroll-mt-20" open={!conn}>
        <summary className="cursor-pointer font-semibold">手入力で登録・スクショから数値を読み取る</summary>

        <div className="mt-4 space-y-6">
          <section>
            <h2 className="text-sm font-bold">📷 スクショから数値を読み取る</h2>
            <p className="mt-1 text-xs text-stone-500">
              Instagramアプリで投稿の「インサイトを見る」を開き、数字が写った画面のスクショを選んでください（3枚・合計3.5MBまで）。
            </p>
            <ActionForm
              action={readScreenshot}
              className="mt-3 grid gap-3 sm:grid-cols-2"
              progressSteps={["AIがスクショの数字を読み取っています…", "もう少しです…"]}
            >
              <div>
                <label className="label">どの投稿の数値？</label>
                <select name="post_id" className="input" defaultValue="">
                  <option value="" disabled>選んでください</option>
                  <option value="new">＋ 新しい投稿として登録する</option>
                  {posts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.posted_at ? fmt(p.posted_at) : "日時不明"}／{POST_TYPE_LABELS[p.media_type ?? ""] ?? p.media_type}
                      {planTitle(p.plan_id) ? `／${planTitle(p.plan_id)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">スクショ</label>
                <FileDrop name="screenshots" multiple what="スクショ" hint="複数選べます" />
              </div>
              <div><SubmitButton className="btn">読み取って保存</SubmitButton></div>
            </ActionForm>
          </section>

          <section className="border-t border-stone-100 pt-6">
            <h2 className="text-sm font-bold">✍️ 公開した投稿を手入力で登録する</h2>
            <p className="mt-1 text-xs text-stone-500">Instagramと連携していないときに使います。</p>
            <ActionForm action={addPost} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">投稿日時</label>
                <input name="posted_at" type="datetime-local" className="input" required />
              </div>
              <div>
                <label className="label">投稿種類</label>
                <select name="media_type" className="input">
                  {Object.entries(POST_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">投稿のURL（任意）</label>
                <input name="permalink" className="input" placeholder="https://www.instagram.com/reel/..." />
              </div>
              <div>
                <label className="label">どの企画の投稿？</label>
                {planSelect()}
              </div>
              <div><SubmitButton className="btn">登録する</SubmitButton></div>
            </ActionForm>
          </section>
        </div>
      </details>
    </div>
  );
}
