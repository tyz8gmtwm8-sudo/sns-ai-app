// 企画が今どの段階にいるかを表示する（素材の確認 → 撮影・編集 → 完成報告 → 投稿・紐付け → 分析）
import Link from "next/link";

const STEPS = [
  { label: "素材の確認", href: (id: string) => `/plans/${id}/materials` },
  { label: "撮影・編集", href: (id: string) => `/plans/${id}/materials` },
  { label: "完成報告", href: (id: string) => `/plans/${id}/report` },
  { label: "投稿・紐付け", href: () => "/posts" },
  { label: "分析", href: () => "/reports" },
];

// 企画の状態 → 今いる段階の番号（0から数える。STEPS.length はすべて完了）
const CURRENT: Record<string, number> = {
  proposed: 0,
  adopted: 0,
  materials_ready: 1,
  reported: 3,
  posted: 4,
  done: STEPS.length,
};

export function PlanSteps({ planId, status }: { planId: string; status: string }) {
  const current = CURRENT[status] ?? 0;
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {STEPS.map((step, i) => {
        const state = i < current ? "done" : i === current ? "now" : "todo";
        return (
          <li key={step.label} className="flex items-center gap-2">
            {i > 0 && <span className={`h-px w-4 sm:w-6 ${i <= current ? "bg-stone-900" : "bg-stone-300"}`} aria-hidden />}
            <Link
              href={step.href(planId)}
              aria-current={state === "now" ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                state === "now"
                  ? "bg-stone-900 font-semibold text-white"
                  : state === "done"
                    ? "text-stone-700 hover:bg-stone-100"
                    : "text-stone-400 hover:bg-stone-100"
              }`}
            >
              <span>{state === "done" ? "✓" : i + 1}</span>
              {step.label}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
