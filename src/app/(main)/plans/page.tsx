import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { adopt } from "@/app/actions/plans";
import { ActionForm } from "@/components/ActionForm";
import { DeletePlanButton } from "@/components/DeletePlanButton";
import { PlanProgressBar } from "@/components/PlanSteps";
import { SubmitButton } from "@/components/SubmitButton";
import { Tabs } from "@/components/Tabs";
import { POST_TYPE_LABELS } from "@/lib/constants";
import type { Plan } from "@/lib/types";

const ADOPT_STEPS = [
  "投稿作成AIがキャプション・ハッシュタグを作っています…",
  "動画構成AIがカット割りを作っています…",
  "編集長AIが撮影タスクを整理しています…",
  "もう少しで完成です…",
];

// 投稿が終わった企画の状態（それ以外は「進行中」）
const POSTED = ["posted", "done"];

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });

// 企画1件分のカード
function PlanCard({ p }: { p: Plan }) {
  return (
    <article className="card space-y-3">
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span>{POST_TYPE_LABELS[p.post_type]}</span>
        <span>·</span>
        <span>{dateLabel(p.created_at)}作成</span>
        <DeletePlanButton planId={p.id} className="ml-auto" />
      </div>
      <h3 className="font-semibold">{p.title}</h3>
      <PlanProgressBar status={p.status} />
      <div className="flex flex-wrap gap-2">
        {p.status === "proposed" ? (
          // 以前に提案されて、まだ採用していない企画
          <ActionForm action={adopt} progressSteps={ADOPT_STEPS}>
            <input type="hidden" name="plan_id" value={p.id} />
            <SubmitButton className="btn px-3 py-1.5 text-xs">採用して素材を作る</SubmitButton>
          </ActionForm>
        ) : (
          <>
            <Link href={`/plans/${p.id}/materials`} className="btn-outline px-3 py-1.5 text-xs">素材を見る</Link>
            {!POSTED.includes(p.status) && (
              <Link href={`/plans/${p.id}/report`} className="btn px-3 py-1.5 text-xs">完成報告へ →</Link>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function PlanList({ plans, empty }: { plans: Plan[]; empty: React.ReactNode }) {
  if (!plans.length) return <p className="card text-sm text-stone-600">{empty}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plans.map((p) => <PlanCard key={p.id} p={p} />)}
    </div>
  );
}

// S-05 企画一覧（企画はネタ帳の「このネタで投稿を作る」から作る）
export default async function PlansPage() {
  const { supabase, account } = await requireOnboardedAccount();
  // 不採用（以前の3案のうち選ばなかったもの）は表示しない
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("account_id", account.id)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(50);
  const plans = (data ?? []) as Plan[];
  const active = plans.filter((p) => !POSTED.includes(p.status));
  const posted = plans.filter((p) => POSTED.includes(p.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">② 企画・素材</h1>
        <p className="mt-1 text-sm text-stone-600">
          新しい企画は、<Link href="/ideas" className="underline">① ネタ帳</Link>でネタを選んで「このネタで投稿を作る」を押すと作られます。
        </p>
      </div>

      <Tabs
        tabs={[
          {
            key: "active",
            label: `進行中（${active.length}）`,
            content: (
              <PlanList
                plans={active}
                empty={<>進行中の企画はありません。<Link href="/ideas" className="underline">ネタ帳</Link>から作ってみましょう。</>}
              />
            ),
          },
          {
            key: "posted",
            label: `投稿済み（${posted.length}）`,
            content: <PlanList plans={posted} empty="投稿済みの企画はまだありません。" />,
          },
        ]}
      />
    </div>
  );
}
