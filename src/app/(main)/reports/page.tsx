import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { REPORT_KIND_LABELS } from "@/lib/constants";
import { runCompetitorAnalysis } from "@/app/actions/instagram";
import { makeReport } from "@/app/actions/posts";
import { MarkRead } from "./MarkRead";
import { ActionForm } from "@/components/ActionForm";
import { getConnection } from "@/lib/instagram/sync";
import type { Analysis, ChiefSummary } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

const fmt = (d: string) => new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });

// S-09 分析レポート
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { id } = await searchParams;
  const { supabase, account } = await requireOnboardedAccount();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, kind, created_at, analysis, summary, post_id, read_at")
    .eq("account_id", account.id)
    // 48時間後レポートはやめたので、以前に作ったものも表示しない（データは残している）
    .neq("kind", "post_48h")
    .order("created_at", { ascending: false })
    .limit(30);

  const selected = reports?.find((r) => r.id === id) ?? reports?.[0];
  const analysis = selected?.analysis as Analysis | undefined;
  const summary = selected?.summary as ChiefSummary | undefined;
  const conn = await getConnection(supabase, account.id);

  // 投稿ごとのレポートは、どの企画の投稿かを一覧に出す（レポート → 投稿 → 企画のタイトル）
  const postIds = [...new Set((reports ?? []).map((r) => r.post_id).filter(Boolean))] as string[];
  const { data: posts } = postIds.length
    ? await supabase.from("posts").select("id, posted_at, plans(title)").in("id", postIds)
    : { data: [] };
  const postLabel = (postId: string | null) => {
    const post = posts?.find((p) => p.id === postId);
    if (!post) return null;
    const plan = post.plans as unknown as { title: string } | null;
    return plan?.title ?? (post.posted_at ? `${fmt(post.posted_at)}の投稿` : "投稿");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="h1">④ レポート</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ActionForm action={makeReport} progressSteps={["分析AIが数値を読み解いています…", "編集長AIが改善案をまとめています…", "もう少しです…"]}>
            <input type="hidden" name="kind" value="weekly" />
            <SubmitButton className="btn-outline">週次レポートを今すぐ作る</SubmitButton>
          </ActionForm>
          {conn ? (
            <ActionForm
              action={runCompetitorAnalysis}
              progressSteps={["競合アカウントの投稿を取得しています…", "分析AIが投稿種類ごとの傾向を読み解いています…", "編集長AIがまとめています…"]}
            >
              <SubmitButton className="btn-outline">競合分析を今すぐする</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-xs text-stone-500">競合分析はInstagram連携後に使えます（毎週月曜に自動実行）</p>
          )}
        </div>
      </div>
      {!reports?.length ? (
        <p className="card text-sm text-stone-600">
          まだレポートはありません。<Link href="/posts" className="underline">③ 投稿</Link>の画面で数値がそろうと、レポートを作れます。
        </p>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* ---------- 左：レポートの一覧 ---------- */}
          <ul className="space-y-1 text-sm">
            {reports.map((r) => {
              const label = postLabel(r.post_id);
              const active = r.id === selected?.id;
              // 開いたことがあるレポートはグレー、まだ開いていないものは今までどおりの表示
              const read = !!r.read_at;
              return (
                <li key={r.id}>
                  <Link
                    href={`/reports?id=${r.id}`}
                    className={`block rounded-lg px-3 py-2 ${active ? "bg-stone-900 text-white" : read ? "text-stone-400 hover:bg-stone-100" : "hover:bg-stone-100"}`}
                  >
                    <span className="block font-medium">{REPORT_KIND_LABELS[r.kind] ?? r.kind}</span>
                    {label && <span className="line-clamp-1 text-xs opacity-80">{label}</span>}
                    <span className="text-xs opacity-60">{fmt(r.created_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* ---------- 右：選んだレポート ---------- */}
          {selected && (
            <div className="space-y-4">
              {/* 表示したレポートを既読にする */}
              {!selected.read_at && <MarkRead reportId={selected.id} />}
              <section className="card space-y-2">
                <p className="text-xs text-stone-500">
                  {REPORT_KIND_LABELS[selected.kind] ?? selected.kind}
                  {postLabel(selected.post_id) && `｜${postLabel(selected.post_id)}`}
                </p>
                {/* いちばん大事な「ひとこと」を大きく出す */}
                {analysis?.headline && <h2 className="text-xl font-bold leading-snug">{analysis.headline}</h2>}
                {summary?.message && <p className="text-sm text-stone-700">🧑‍💼 {summary.message}</p>}
              </section>

              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  { title: "良かった点", color: "border-emerald-200 bg-emerald-50/50", head: "text-emerald-800", items: analysis?.good_points },
                  { title: "課題", color: "border-rose-200 bg-rose-50/50", head: "text-rose-800", items: analysis?.issues },
                  { title: "改善案", color: "border-amber-200 bg-amber-50/50", head: "text-amber-900", items: summary?.improvements },
                ].map((col) => (
                  <section key={col.title} className={`rounded-2xl border p-4 ${col.color}`}>
                    <h3 className={`text-sm font-bold ${col.head}`}>{col.title}</h3>
                    {col.items?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{col.items.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500">なし</p>
                    )}
                  </section>
                ))}
              </div>

              {analysis?.metrics_comment && (
                <details className="card text-sm">
                  <summary className="cursor-pointer font-semibold">📊 数値の解説</summary>
                  <p className="mt-2 whitespace-pre-wrap text-stone-700">{analysis.metrics_comment}</p>
                </details>
              )}

              {!!summary?.next_suggestions.length && (
                <section className="card">
                  <h3 className="text-sm font-bold">次の投稿への提案</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{summary.next_suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  <p className="mt-3 text-xs text-stone-500">
                    ネタ帳の「AIからの提案」は、このレポートの内容も読んで次のネタを提案します。
                  </p>
                  <Link href="/ideas" className="btn mt-2">💡 ネタ帳で次のネタを提案してもらう</Link>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
