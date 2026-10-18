import { requireOnboardedAccount } from "@/lib/account";
import { addPost, confirmLink, makeReport, readScreenshot, saveInsights } from "@/app/actions/posts";
import { ActionForm } from "@/components/ActionForm";
import { POST_TYPE_LABELS } from "@/lib/constants";
import { syncNow } from "@/app/actions/instagram";
import { getConnection } from "@/lib/instagram/sync";
import { SubmitButton } from "@/components/SubmitButton";
import { FileDrop } from "@/components/FileDrop";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h1">投稿の紐付け</h1>
        <div className="flex flex-wrap gap-2">
          {conn && (
            <ActionForm action={syncNow} progressSteps={["Instagramから投稿とインサイトを取得しています…", "紐付け候補を探しています…"]}>
              <SubmitButton className="btn">Instagramから今すぐ取得</SubmitButton>
            </ActionForm>
          )}
          <ActionForm action={makeReport} progressSteps={REPORT_STEPS}>
            <input type="hidden" name="kind" value="weekly" />
            <SubmitButton className="btn-outline">週次レポートを今すぐ作る</SubmitButton>
          </ActionForm>
        </div>
      </div>
      {conn ? (
        <p className="text-sm text-stone-600">
          @{conn.ig_username} の投稿とインサイトは毎日自動で取得します。新しい投稿は、完成報告のキャプションと比べて紐付け候補を出します。
        </p>
      ) : (
        <p className="text-sm text-stone-600">
          Instagram未連携です。<a href="/settings" className="underline">設定</a>から連携すると、投稿とインサイトを自動で取得します。
        </p>
      )}

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
          <div><SubmitButton className="btn">登録する</SubmitButton></div>
        </ActionForm>
      </section>

      <section id="screenshot" className="card scroll-mt-20">
        <h2 className="h2">📷 スクショから数値を読み取る</h2>
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
            <label className="label">スクショ（複数選べます）</label>
            <FileDrop name="screenshots" multiple what="スクショ" hint="複数選べます" />
          </div>
          <div><SubmitButton className="btn">読み取って保存</SubmitButton></div>
        </ActionForm>
      </section>

      {posts.map((post) => {
        const latest = [...post.insights].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
        return (
          <section key={post.id} className="card space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {post.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.thumbnail_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
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
                <SubmitButton className="btn shrink-0">この企画と紐付けを確定</SubmitButton>
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
                <div className="flex items-end"><SubmitButton className="btn-outline w-full">保存</SubmitButton></div>
              </ActionForm>
            </details>

            <div className="flex flex-wrap gap-2">
              {([["post_48h", "48時間後レポート"], ["post_7d", "7日後レポート"]] as const).map(([kind, label]) => (
                <ActionForm key={kind} action={makeReport} progressSteps={REPORT_STEPS}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="post_id" value={post.id} />
                  <SubmitButton className="btn-outline text-xs" disabled={!latest}>{label}を作る</SubmitButton>
                </ActionForm>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
