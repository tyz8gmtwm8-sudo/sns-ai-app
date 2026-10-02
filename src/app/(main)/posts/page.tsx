import { requireOnboardedAccount } from "@/lib/account";
import { addPost, confirmLink, makeReport, saveInsights } from "@/app/actions/posts";
import { ActionForm } from "@/components/ActionForm";
import { POST_TYPE_LABELS } from "@/lib/constants";

type Insight = { likes: number | null; comments: number | null; reach: number | null; saves: number | null; shares: number | null; plays: number | null; captured_at: string; source: string };
type PostRow = {
  id: string;
  media_type: string | null;
  permalink: string | null;
  caption: string | null;
  posted_at: string | null;
  plan_id: string | null;
  link_status: string;
  insights: Insight[];
};

const REPORT_STEPS = ["分析AIが数値を読み解いています…", "編集長AIが改善案をまとめています…", "もう少しです…"];
const fmt = (d: string) => new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });

// S-08 投稿の紐付け（＋数値の手入力）
export default async function PostsPage() {
  const { supabase } = await requireOnboardedAccount();
  const [{ data: postsData }, { data: plans }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, media_type, permalink, caption, posted_at, plan_id, link_status, insights(likes, comments, reach, saves, shares, plays, captured_at, source)")
      .order("posted_at", { ascending: false })
      .limit(30),
    supabase.from("plans").select("id, title, status").in("status", ["materials_ready", "reported", "posted", "done"]).order("created_at", { ascending: false }),
  ]);
  const posts = (postsData ?? []) as PostRow[];
  const planTitle = (id: string | null) => plans?.find((p) => p.id === id)?.title;

  const planSelect = (defaultValue?: string | null) => (
    <select name="plan_id" className="input" defaultValue={defaultValue ?? ""}>
      <option value="">企画を選ぶ</option>
      {plans?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h1">投稿の紐付け</h1>
        <ActionForm action={makeReport} progressSteps={REPORT_STEPS}>
          <input type="hidden" name="kind" value="weekly" />
          <button className="btn-outline">週次レポートを今すぐ作る</button>
        </ActionForm>
      </div>

      <section className="card">
        <h2 className="h2">公開した投稿を登録する</h2>
        <p className="mt-1 text-xs text-stone-500">Instagram連携前は、ここから手入力で登録します。</p>
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
          <div><button className="btn">登録する</button></div>
        </ActionForm>
      </section>

      {posts.map((post) => {
        const latest = [...post.insights].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
        return (
          <section key={post.id} className="card space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge">{POST_TYPE_LABELS[post.media_type ?? ""] ?? post.media_type}</span>
              {post.posted_at && <span className="text-sm text-stone-500">{fmt(post.posted_at)}</span>}
              {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="text-sm underline">Instagramで見る</a>}
              <span className={`badge ml-auto ${post.link_status === "confirmed" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                {post.link_status === "confirmed" ? `紐付け済み：${planTitle(post.plan_id) ?? ""}` : post.link_status === "suggested" ? "紐付け候補あり" : "未紐付け"}
              </span>
            </div>
            {post.caption && <p className="line-clamp-2 text-sm text-stone-600">{post.caption}</p>}

            {post.link_status !== "confirmed" && (
              <ActionForm action={confirmLink} className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 sm:flex-row">
                <input type="hidden" name="post_id" value={post.id} />
                {planSelect(post.plan_id)}
                <button className="btn shrink-0">この企画と紐付けを確定</button>
              </ActionForm>
            )}

            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                数値 {latest ? `（いいね${latest.likes ?? "-"}・保存${latest.saves ?? "-"}・リーチ${latest.reach ?? "-"}／${fmt(latest.captured_at)}時点）` : "（未入力）"}
              </summary>
              <ActionForm action={saveInsights} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-7">
                <input type="hidden" name="post_id" value={post.id} />
                {[["likes", "いいね"], ["comments", "コメント"], ["reach", "リーチ"], ["saves", "保存"], ["shares", "シェア"], ["plays", "再生数"]].map(([k, l]) => (
                  <div key={k}>
                    <label className="label">{l}</label>
                    <input name={k} inputMode="numeric" className="input" defaultValue={latest?.[k as keyof Insight] ?? ""} />
                  </div>
                ))}
                <div className="flex items-end"><button className="btn-outline w-full">保存</button></div>
              </ActionForm>
            </details>

            <div className="flex flex-wrap gap-2">
              {([["post_48h", "48時間後レポート"], ["post_7d", "7日後レポート"]] as const).map(([kind, label]) => (
                <ActionForm key={kind} action={makeReport} progressSteps={REPORT_STEPS}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="post_id" value={post.id} />
                  <button className="btn-outline text-xs" disabled={!latest}>{label}を作る</button>
                </ActionForm>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
