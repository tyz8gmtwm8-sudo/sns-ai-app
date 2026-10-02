import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { REPORT_KIND_LABELS } from "@/lib/constants";
import type { Analysis, ChiefSummary } from "@/lib/types";

const fmt = (d: string) => new Date(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });

// S-09 分析レポート
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { id } = await searchParams;
  const { supabase } = await requireOnboardedAccount();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, kind, created_at, analysis, summary")
    .order("created_at", { ascending: false })
    .limit(30);

  const selected = reports?.find((r) => r.id === id) ?? reports?.[0];
  const analysis = selected?.analysis as Analysis | undefined;
  const summary = selected?.summary as ChiefSummary | undefined;

  return (
    <div className="space-y-6">
      <h1 className="h1">分析レポート</h1>
      {!reports?.length ? (
        <p className="card text-sm text-stone-600">
          まだレポートはありません。<Link href="/posts" className="underline">投稿</Link>画面で数値を入力して、レポートを作りましょう。
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <ul className="space-y-1 text-sm">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports?id=${r.id}`}
                  className={`block rounded-lg px-3 py-2 ${r.id === selected?.id ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}
                >
                  <span className="block font-medium">{REPORT_KIND_LABELS[r.kind] ?? r.kind}</span>
                  <span className="text-xs opacity-70">{fmt(r.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="space-y-4">
              {summary && (
                <section className="card border-stone-900">
                  <h2 className="h2">🧑‍💼 編集長AIのまとめ</h2>
                  <p className="mt-2 text-sm">{summary.message}</p>
                  <h3 className="mt-4 text-sm font-semibold">改善案</h3>
                  <ul className="mt-1 list-disc pl-5 text-sm">{summary.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  <h3 className="mt-4 text-sm font-semibold">次の企画への提案</h3>
                  <ul className="mt-1 list-disc pl-5 text-sm">{summary.next_suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  <Link href="/plans" className="btn mt-4">この改善案で次の企画を作る</Link>
                </section>
              )}
              {analysis && (
                <section className="card">
                  <h2 className="h2">📊 分析AIのレポート</h2>
                  <p className="mt-2 font-medium">{analysis.headline}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{analysis.metrics_comment}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-700">良かった点</h3>
                      <ul className="mt-1 list-disc pl-5 text-sm">{analysis.good_points.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-rose-700">課題</h3>
                      <ul className="mt-1 list-disc pl-5 text-sm">{analysis.issues.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
