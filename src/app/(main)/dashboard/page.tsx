import Link from "next/link";
import { accountLabel, requireOnboardedAccount } from "@/lib/account";
import { toggleTask } from "@/app/actions/plans";
import { PLAN_STATUS_LABELS, POST_TYPE_LABELS, REPORT_KIND_LABELS } from "@/lib/constants";
import type { ChiefSummary, Plan, Task } from "@/lib/types";
import { getConnection } from "@/lib/instagram/sync";

// S-04 ダッシュボード（画面3）
export default async function DashboardPage() {
  const { supabase, account } = await requireOnboardedAccount();

  const [{ data: tasks }, { data: activePlans }, { data: proposed }, { data: latestReport }, { data: notifications }] =
    await Promise.all([
      supabase.from("tasks").select("*").eq("account_id", account.id).eq("status", "todo").order("created_at").order("sort"),
      supabase
        .from("plans")
        .select("*")
        .eq("account_id", account.id)
        .in("status", ["adopted", "materials_ready", "reported", "posted"])
        .order("adopted_at", { ascending: false }),
      supabase.from("plans").select("id").eq("account_id", account.id).eq("status", "proposed").limit(1),
      supabase.from("reports").select("*").eq("account_id", account.id).neq("kind", "competitor").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("notifications").select("*").eq("account_id", account.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
    ]);

  const summary = latestReport?.summary as ChiefSummary | undefined;

  // 連携切れや、定期実行の失敗があれば知らせる
  const conn = await getConnection(supabase, account.id);
  const { data: lastJob } = await supabase
    .from("job_runs")
    .select("status, detail, created_at")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const hasWork = (tasks?.length ?? 0) > 0 || (activePlans?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-stone-500">{accountLabel(account)}</p>
        <h1 className="h1">ダッシュボード</h1>
      </div>

      {conn?.status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ⚠️ Instagram連携が切れています。<Link href="/settings" className="underline">設定</Link>から再連携してください。それまでは
          <Link href="/posts#screenshot" className="mx-1 underline">スクショ読み取り</Link>で数値を取り込めます。
        </div>
      )}
      {lastJob?.status === "failed" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          ⚠️ {new Date(lastJob.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}の自動処理に失敗しました（翌日に自動で再実行します）。
          <span className="block text-xs">{lastJob.detail}</span>
        </div>
      )}

      {/* 編集長AIからの指示 */}
      <section className="card">
        <h2 className="h2">🧑‍💼 編集長AIからの「今日やること」</h2>
        {tasks?.length ? (
          <ul className="mt-3 divide-y divide-stone-100">
            {(tasks as Task[]).map((t) => (
              <li key={t.id} className="flex items-start gap-3 py-3">
                <form action={toggleTask}>
                  <input type="hidden" name="task_id" value={t.id} />
                  <input type="hidden" name="done" value="true" />
                  <button className="mt-0.5 h-5 w-5 rounded border border-stone-400 hover:bg-stone-100" aria-label="完了にする" />
                </form>
                <div className="flex-1">
                  <p className="font-medium">{t.title}</p>
                  {t.detail && <p className="mt-0.5 whitespace-pre-wrap text-sm text-stone-600">{t.detail}</p>}
                </div>
                {t.link && <Link href={t.link} className="btn-outline shrink-0 px-3 py-1 text-xs">開く</Link>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 text-sm text-stone-600">
            {proposed?.length ? (
              <p>企画案が届いています。1件選んで採用しましょう。</p>
            ) : (
              <p>{hasWork ? "今やるタスクはありません。" : "まずはAIチームに企画を提案してもらいましょう。"}</p>
            )}
            <Link href="/plans" className="btn mt-3">{proposed?.length ? "企画案を見る" : "企画を提案してもらう"}</Link>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 進行中の企画 */}
        <section className="card">
          <h2 className="h2">進行中の企画</h2>
          {activePlans?.length ? (
            <ul className="mt-3 space-y-2">
              {(activePlans as Plan[]).map((p) => (
                <li key={p.id}>
                  <Link href={`/plans/${p.id}/materials`} className="block rounded-xl border border-stone-200 p-3 hover:bg-stone-50">
                    <div className="flex gap-2">
                      <span className="badge">{POST_TYPE_LABELS[p.post_type]}</span>
                      <span className="badge bg-amber-100 text-amber-900">{PLAN_STATUS_LABELS[p.status]}</span>
                    </div>
                    <p className="mt-1 font-medium">{p.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-500">進行中の企画はありません。</p>
          )}
        </section>

        {/* 最新レポート */}
        <section className="card">
          <h2 className="h2">最新レポート</h2>
          {latestReport && summary ? (
            <div className="mt-3 text-sm">
              <span className="badge">{REPORT_KIND_LABELS[latestReport.kind]}</span>
              <p className="mt-2">{summary.message}</p>
              <ul className="mt-2 list-disc pl-5 text-stone-600">
                {summary.improvements.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
              <Link href={`/reports?id=${latestReport.id}`} className="mt-3 inline-block underline">詳しく見る</Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">投稿を分析するとここに表示されます。</p>
          )}
        </section>
      </div>

      {/* 通知 */}
      {!!notifications?.length && (
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="h2">新しいお知らせ</h2>
            <Link href="/notifications" className="text-sm underline">すべて見る</Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/notifications"} className="hover:underline">
                  <span className="font-medium">{n.title}</span>
                  {n.body && <span className="text-stone-500"> — {n.body}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
