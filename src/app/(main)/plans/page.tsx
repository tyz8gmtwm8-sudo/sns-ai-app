import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { adopt } from "@/app/actions/plans";
import { ActionForm } from "@/components/ActionForm";
import { DeletePlanButton } from "@/components/DeletePlanButton";
import { PLAN_STATUS_LABELS, POST_TYPE_LABELS } from "@/lib/constants";
import type { Plan } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

const ADOPT_STEPS = [
  "投稿作成AIがキャプション・ハッシュタグを作っています…",
  "動画構成AIがカット割りを作っています…",
  "編集長AIが撮影タスクを整理しています…",
  "もう少しで完成です…",
];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">企画一覧</h1>
        <p className="mt-1 text-sm text-stone-600">
          新しい企画は、<Link href="/ideas" className="underline">ネタ帳</Link>でネタを選んで「このネタで投稿を作る」を押すと作られます。
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="card text-sm text-stone-600">
          まだ企画がありません。<Link href="/ideas" className="underline">ネタ帳</Link>から作ってみましょう。
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="badge">{PLAN_STATUS_LABELS[p.status] ?? p.status}</span>
              <span className="badge">{POST_TYPE_LABELS[p.post_type]}</span>
              <span className="flex-1">{p.title}</span>
              {p.status === "proposed" ? (
                <ActionForm action={adopt} progressSteps={ADOPT_STEPS}>
                  <input type="hidden" name="plan_id" value={p.id} />
                  <SubmitButton className="btn-outline px-3 py-1 text-xs">採用して素材を作る</SubmitButton>
                </ActionForm>
              ) : (
                <Link href={`/plans/${p.id}/materials`} className="underline">素材</Link>
              )}
              <DeletePlanButton planId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
