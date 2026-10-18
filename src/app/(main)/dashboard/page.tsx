import Link from "next/link";
import { accountLabel, requireOnboardedAccount } from "@/lib/account";
import { toggleTask } from "@/app/actions/plans";
import { POST_TYPE_LABELS, REPORT_KIND_LABELS } from "@/lib/constants";
import type { ChiefSummary, Plan, Task } from "@/lib/types";
import { getConnection } from "@/lib/instagram/sync";
import { SubmitButton } from "@/components/SubmitButton";
import { planProgress } from "@/components/PlanSteps";

// S-04 ダッシュボード（画面3）
export default async function DashboardPage() {
  const { supabase, account } = await requireOnboardedAccount();

  const [{ data: tasks }, { data: activePlans }, { data: latestReport }, { data: notifications }, { count: unusedIdeas }, { count: unread }] =
    await Promise.all([
      supabase.from("tasks").select("*").eq("account_id", account.id).eq("status", "todo").order("created_at").order("sort"),
      supabase
        .from("plans")
        .select("*")
        .eq("account_id", account.id)
        .in("status", ["adopted", "materials_ready", "reported", "posted"])
        .order("adopted_at", { ascending: false }),
      supabase.from("reports").select("*").eq("account_id", account.id).neq("kind", "competitor").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("notifications").select("*").eq("account_id", account.id).is("read_at", null).order("created_at", { ascending: false }).limit(3),
      supabase.from("ideas").select("id", { count: "exact", head: true }).eq("account_id", account.id).eq("status", "unused"),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("account_id", account.id).is("read_at", null),
    ]);

  const summary = latestReport?.summary as ChiefSummary | undefined;
  const plans = (activePlans ?? []) as Plan[];
  const todo = (tasks ?? []) as Task[];

  // 「今日やること」を企画ごとにまとめる（企画に結びつかないものは「そのほか」）
  const groups = [
    ...plans.map((p) => ({ key: p.id, title: p.title, href: `/plans/${p.id}/materials`, tasks: todo.filter((t) => t.plan_id === p.id) })),
    { key: "other", title: "そのほか", href: null, tasks: todo.filter((t) => !t.plan_id || !plans.some((p) => p.id === t.plan_id)) },
  ].filter((g) => g.tasks.length > 0);

  // 連携切れや、定期実行の失敗があれば知らせる
  const conn = await getConnection(supabase, account.id);
  const { data: lastJob } = await supabase
    .from("job_runs")
    .select("status, detail, created_at")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 上に並べる数字のまとめ（押すとその画面に移動する）
  const stats = [
    { label: "未使用のネタ", value: unusedIdeas ?? 0, href: "/ideas" },
    { label: "進行中の企画", value: plans.length, href: "/plans" },
    { label: "やること", value: todo.length, href: "#todo" },
    { label: "未読のお知らせ", value: unread ?? 0, href: "/notifications" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">こんにちは</p>
        <h1 className="h1">{accountLabel(account)}</h1>
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

      {/* ---------- 数字のまとめ ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((st) => (
          <Link key={st.label} href={st.href} className="card p-4 transition hover:border-stone-400">
            <p className="text-xs text-stone-500">{st.label}</p>
            <p className="mt-1 text-2xl font-bold">
              {st.value}
              <span className="ml-0.5 text-sm font-normal text-stone-500">件</span>
            </p>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------- 左：今日やること ---------- */}
        <section id="todo" className="card">
          <h2 className="h2">🧑‍💼 今日やること</h2>
          <p className="mt-1 text-xs text-stone-500">編集長AIからの指示です。終わったら左の四角を押してください。</p>
          {groups.length ? (
            <div className="mt-4 space-y-5">
              {groups.map((g) => (
                <div key={g.key}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <span className="h-3 w-1 rounded-full bg-stone-900" aria-hidden />
                    {g.href ? <Link href={g.href} className="hover:underline">{g.title}</Link> : g.title}
                  </h3>
                  <ul className="mt-2 divide-y divide-stone-100">
                    {g.tasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-3 py-2.5">
                        <form action={toggleTask}>
                          <input type="hidden" name="task_id" value={t.id} />
                          <input type="hidden" name="done" value="true" />
                          <SubmitButton className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-stone-400 text-stone-500 hover:bg-stone-100 [&_.spinner]:h-3 [&_.spinner]:w-3" aria-label="完了にする" />
                        </form>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{t.title}</p>
                          {t.detail && (
                            // 説明は1行だけ出し、「詳しく」を押すと全部表示する
                            <details className="group mt-0.5 text-sm text-stone-600">
                              <summary className="flex cursor-pointer list-none gap-2">
                                <span className="line-clamp-1 flex-1 group-open:hidden">{t.detail}</span>
                                <span className="shrink-0 text-xs text-stone-500 underline group-open:hidden">詳しく</span>
                                <span className="hidden text-xs text-stone-500 underline group-open:inline">閉じる</span>
                              </summary>
                              <p className="mt-1 whitespace-pre-wrap">{t.detail}</p>
                            </details>
                          )}
                        </div>
                        {t.link && <Link href={t.link} className="btn-outline shrink-0 px-3 py-1 text-xs">開く</Link>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
              <p>{plans.length ? "今やることはありません。" : "まずはネタ帳にネタを登録して、投稿を作ってみましょう。"}</p>
              <Link href="/ideas" className="btn mt-3">① ネタ帳を開く</Link>
            </div>
          )}
        </section>

        {/* ---------- 右：進行中の企画・最新レポート・お知らせ ---------- */}
        <div className="space-y-6">
          <section className="card">
            <h2 className="h2">進行中の企画</h2>
            {plans.length ? (
              <ul className="mt-3 space-y-2">
                {plans.map((p) => {
                  const prog = planProgress(p.status);
                  return (
                    <li key={p.id}>
                      <Link href={`/plans/${p.id}/materials`} className="block rounded-xl border border-stone-200 p-3 hover:bg-stone-50">
                        <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                        {/* 進み具合：■■□□□ のようなバー */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex flex-1 gap-0.5" aria-hidden>
                            {Array.from({ length: prog.total }, (_, i) => (
                              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < prog.current ? "bg-stone-900" : i === prog.current ? "bg-stone-400" : "bg-stone-200"}`} />
                            ))}
                          </div>
                          <span className="shrink-0 text-xs text-stone-500">{prog.label}</span>
                        </div>
                        <span className="mt-1 inline-block text-[11px] text-stone-400">{POST_TYPE_LABELS[p.post_type]}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone-500">進行中の企画はありません。</p>
            )}
          </section>

          <section className="card">
            <h2 className="h2">最新レポート</h2>
            {latestReport && summary ? (
              <div className="mt-3 text-sm">
                <span className="badge">{REPORT_KIND_LABELS[latestReport.kind]}</span>
                <p className="mt-2 line-clamp-3">{summary.message}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600">
                  {summary.improvements.slice(0, 3).map((s, i) => <li key={i} className="line-clamp-2">{s}</li>)}
                </ul>
                <Link href={`/reports?id=${latestReport.id}`} className="mt-3 inline-block underline">詳しく見る</Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">投稿を分析するとここに表示されます。</p>
            )}
          </section>

          {!!notifications?.length && (
            <section className="card">
              <div className="flex items-center justify-between">
                <h2 className="h2">お知らせ</h2>
                <Link href="/notifications" className="text-xs underline">すべて見る</Link>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link href={n.link ?? "/notifications"} className="block hover:underline">
                      <span className="font-medium">{n.title}</span>
                      {n.body && <span className="line-clamp-2 text-xs text-stone-500">{n.body}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
