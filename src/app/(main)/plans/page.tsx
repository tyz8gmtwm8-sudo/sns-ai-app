import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { adopt, generatePlans, revise } from "@/app/actions/plans";
import { InstructionInput } from "@/components/InstructionInput";
import type { Idea } from "@/lib/ideas";
import { ActionForm } from "@/components/ActionForm";
import { PLAN_STATUS_LABELS, POST_TYPE_LABELS } from "@/lib/constants";
import type { Plan } from "@/lib/types";

const PROPOSE_STEPS = [
  "リサーチAIが季節ネタ・地域の話題を検索しています…",
  "リサーチAIがトレンドを整理しています…",
  "企画AIが競合分析と過去の改善案を読んでいます…",
  "企画AIが企画案を3件まとめています…",
  "もう少しで完成です…",
];
const REVISE_STEPS = ["企画AIが指示どおりに直しています…", "もう少しです…"];
const PLAN_CHIPS = ["もっと具体的に", "撮影しやすく", "別の切り口で", "リールで", "カルーセルで", "季節感を出して"];
const ADOPT_STEPS = [
  "投稿作成AIがキャプション・ハッシュタグを作っています…",
  "動画構成AIがカット割りを作っています…",
  "編集長AIが撮影タスクを整理しています…",
  "もう少しで完成です…",
];

// S-05 企画選択
export default async function PlansPage() {
  const { supabase, account } = await requireOnboardedAccount();
  const { data } = await supabase.from("plans").select("*").eq("account_id", account.id).order("created_at", { ascending: false }).limit(30);
  const plans = (data ?? []) as (Plan & { recommendation: string | null; research_memo_id: string | null })[];
  const { data: ideaData } = await supabase.from("ideas").select("*").eq("account_id", account.id).order("created_at", { ascending: false });
  const ideas = (ideaData ?? []) as Idea[];
  const unusedIdeas = ideas.filter((i) => i.status === "unused");
  const ideaTitles = (ids?: string[]) => (ids ?? []).map((id) => ideas.find((i) => i.id === id)?.title).filter(Boolean);
  const proposed = plans.filter((p) => p.status === "proposed");
  const others = plans.filter((p) => p.status !== "proposed");

  const memoId = proposed[0]?.research_memo_id;
  const { data: memo } = memoId
    ? await supabase.from("research_memos").select("content, sources").eq("id", memoId).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <h1 className="h1">企画選択</h1>

      {proposed.length > 0 ? (
        <>
          {proposed[0].recommendation && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <span className="font-semibold">おすすめの投稿種類：</span>
              {proposed[0].recommendation}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {proposed.map((p, i) => (
              <div key={p.id} className="card flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">案{i + 1}</span>
                  <span className="badge">{POST_TYPE_LABELS[p.post_type]}</span>
                </div>
                <h2 className="mt-2 font-bold">{p.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{p.concept}</p>
                {p.reason && <p className="mt-2 text-xs text-stone-500">💡 {p.reason}</p>}
                {ideaTitles(p.idea_ids).length > 0 && (
                  <p className="mt-2 text-xs text-emerald-800">📒 ネタ：{ideaTitles(p.idea_ids).join("、")}</p>
                )}
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-stone-600 underline">この案だけ修正する</summary>
                  <ActionForm action={revise} className="mt-2 space-y-2" progressSteps={REVISE_STEPS}>
                    <input type="hidden" name="plan_id" value={p.id} />
                    <InstructionInput placeholder="例：店内の写真が少ないので料理中心にして" chips={PLAN_CHIPS} required />
                    <button className="btn-outline w-full">指示どおりに修正</button>
                  </ActionForm>
                </details>
                <ActionForm action={adopt} className="mt-auto pt-4" progressSteps={ADOPT_STEPS}>
                  <input type="hidden" name="plan_id" value={p.id} />
                  <button className="btn w-full">この企画を採用</button>
                </ActionForm>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-stone-600">
          「企画を提案してもらう」を押すと、リサーチAIと企画AIが企画案を3件作ります（1分ほどかかります）。
        </p>
      )}

      <section className="card">
        <h2 className="h2">{proposed.length ? "別の企画案を出してもらう" : "企画を提案してもらう"}</h2>
        <ActionForm action={generatePlans} className="mt-3 space-y-4" progressSteps={PROPOSE_STEPS}>
          <div>
            <p className="label">📒 ネタ帳から使うネタを選ぶ（選ぶと、そのネタだけで企画します）</p>
            {unusedIdeas.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {unusedIdeas.map((idea) => (
                  <label key={idea.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 bg-white p-3 text-sm has-[:checked]:border-stone-900 has-[:checked]:bg-stone-50">
                    <input type="checkbox" name="idea_ids" value={idea.id} className="mt-1" />
                    <span>
                      <span className="font-medium">{idea.title}</span>
                      {idea.photo_paths.length > 0 && <span className="ml-1 text-xs text-stone-500">📷{idea.photo_paths.length}</span>}
                      {idea.memo && <span className="line-clamp-2 block text-xs text-stone-500">{idea.memo}</span>}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                ネタ帳が空です。<Link href="/ideas" className="underline">ネタ帳</Link>に行ったお店や撮った写真を登録すると、想像ではなく実際の素材をもとに企画できます。
              </p>
            )}
          </div>
          <InstructionInput placeholder="（任意）要望があれば入力 例：今週はカフェ以外で" chips={PLAN_CHIPS} />
          <button className="btn">{proposed.length ? "再生成する" : "企画を提案してもらう"}</button>
        </ActionForm>
      </section>

      {memo && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-semibold">リサーチAIのメモを見る</summary>
          <div className="mt-3 whitespace-pre-wrap text-stone-700">{memo.content}</div>
          {(memo.sources as { title: string; url: string }[]).length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-xs text-stone-500">
              {(memo.sources as { title: string; url: string }[]).map((s, i) => (
                <li key={i}><a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title || s.url}</a></li>
              ))}
            </ul>
          )}
        </details>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="h2">これまでの企画</h2>
          <ul className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="badge">{PLAN_STATUS_LABELS[p.status] ?? p.status}</span>
                <span className="flex-1">{p.title}</span>
                {p.status !== "rejected" && (
                  <Link href={`/plans/${p.id}/materials`} className="underline">素材</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
