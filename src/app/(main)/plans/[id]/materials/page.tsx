import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedAccount } from "@/lib/account";
import { PLAN_STATUS_LABELS, POST_TYPE_LABELS } from "@/lib/constants";
import type { Bgm, Cut, Hashtags, Materials, Plan } from "@/lib/types";
import { MaterialSection } from "./MaterialSection";
import { DeletePlanButton } from "@/components/DeletePlanButton";
import { PlanSteps } from "@/components/PlanSteps";

const hashtagText = (h: Hashtags | null) =>
  h ? [...h.large, ...h.medium, ...h.small].map((t) => "#" + t).join(" ") : "";

// S-06 素材確認・編集
export default async function MaterialsPage({ params }: PageProps<"/plans/[id]/materials">) {
  const { id } = await params;
  const { supabase, account } = await requireOnboardedAccount();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", id).eq("account_id", account.id).maybeSingle();
  // 見つからない（または別のアカウントの企画）ときは企画一覧へ
  if (!plan) redirect("/plans");
  const { data } = await supabase.from("materials").select("*").eq("plan_id", id).maybeSingle();
  const m = data as Materials | null;
  const p = plan as Plan;

  const total = m?.hashtags ? m.hashtags.large.length + m.hashtags.medium.length + m.hashtags.small.length : 0;
  // BGMを入力しやすいように、Instagram内3件・著作権フリー2件の空行を足しておく
  const bgmRows = (source: Bgm["source"], min: number) => {
    const rows = (m?.bgm ?? []).filter((b) => b.source === source);
    while (rows.length < min) rows.push({ name: "", artist: "", source, reason: "" });
    return rows;
  };
  const cuts: Cut[] = [...(m?.reel_structure ?? []), { start: 0, end: 0, scene: "", shot: "", telop: "" }];
  const isReel = p.post_type === "reel";

  return (
    <div className="space-y-6">
      <PlanSteps planId={id} status={p.status} />
      <div>
        <div className="flex items-center gap-2">
          <span className="badge">{POST_TYPE_LABELS[p.post_type]}</span>
          <span className="badge bg-amber-100 text-amber-900">{PLAN_STATUS_LABELS[p.status]}</span>
          <DeletePlanButton planId={p.id} className="ml-auto" />
        </div>
        <h1 className="h1 mt-2">{p.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{p.concept}</p>
      </div>

      {!m ? (
        <p className="card text-sm text-stone-600">素材はまだありません。企画画面で採用すると作られます。</p>
      ) : (
        <>
          <MaterialSection planId={id} target="caption" title="キャプション" copyText={`${m.caption ?? ""}\n\n${hashtagText(m.hashtags)}`}>
            <textarea name="caption" rows={22} className="input" defaultValue={m.caption ?? ""} />
          </MaterialSection>

          <MaterialSection
            planId={id}
            target="hashtags"
            title={`ハッシュタグ（${total}個）`}
            copyText={hashtagText(m.hashtags)}
            note={<p className="mt-1 text-xs text-stone-500">スペース区切りで編集できます。合計30個以内にしてください。</p>}
          >
            {(["large", "medium", "small"] as const).map((k) => (
              <div key={k}>
                <label className="label">{{ large: "大規模（100万件以上）", medium: "中規模（10万〜100万件）", small: "小規模・ニッチ（10万件未満）" }[k]}</label>
                <textarea name={k} rows={2} className="input" defaultValue={(m.hashtags?.[k] ?? []).map((t) => "#" + t).join(" ")} />
              </div>
            ))}
          </MaterialSection>

          <MaterialSection
            planId={id}
            target="bgm"
            title="BGM候補"
            note={
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                ⚠️ Instagram内のトレンド音源は日々変わります。使う前に、Instagramアプリの音源検索で実在するか・ビジネスアカウントで使えるかを必ず確認してください。
              </p>
            }
          >
            {([["instagram", "🎵 Instagram内音源", 3], ["free", "🆓 著作権フリー音源", 2]] as const).map(([source, label, min]) => (
              <div key={source}>
                <p className="label">{label}</p>
                <div className="space-y-2">
                  {bgmRows(source, min).map((b, i) => (
                    <div key={i} className="grid gap-2 rounded-lg bg-stone-50 p-2 sm:grid-cols-[1fr_1fr_2fr]">
                      <input type="hidden" name="bgm_source" value={source} />
                      <input name="bgm_name" className="input" defaultValue={b.name} placeholder="曲名・雰囲気" />
                      <input name="bgm_artist" className="input" defaultValue={b.artist} placeholder="アーティスト・サイト" />
                      <input name="bgm_reason" className="input" defaultValue={b.reason} placeholder="選んだ理由" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </MaterialSection>

          <MaterialSection
            planId={id}
            target="structure"
            title={isReel ? "リール構成案" : "投稿の構成案（枚目ごと）"}
            note={<p className="mt-1 text-xs text-stone-500">{isReel ? "開始・終了は秒数です。" : "開始・終了には何枚目かを入れます。"}一番下の空行に入力すると行を追加できます。</p>}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-stone-500">
                  <tr><th className="w-16">開始</th><th className="w-16">終了</th><th>場面</th><th>撮り方</th><th>テロップ</th></tr>
                </thead>
                <tbody>
                  {cuts.map((c, i) => (
                    <tr key={i}>
                      <td className="pr-1 py-1"><input name="cut_start" type="number" className="input" defaultValue={c.start} /></td>
                      <td className="pr-1"><input name="cut_end" type="number" className="input" defaultValue={c.end} /></td>
                      <td className="pr-1"><input name="cut_scene" className="input" defaultValue={c.scene} /></td>
                      <td className="pr-1"><input name="cut_shot" className="input" defaultValue={c.shot} /></td>
                      <td><input name="cut_telop" className="input" defaultValue={c.telop} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <label className="label">📷 撮るべきカットのリスト（1行に1つ）</label>
              <textarea name="shot_list" rows={6} className="input" defaultValue={(m.shot_list ?? []).join("\n")} />
            </div>
          </MaterialSection>

          <MaterialSection planId={id} target="telops" title="テロップ文章" copyText={(m.telops ?? []).join("\n")}>
            <textarea name="telops" rows={6} className="input" defaultValue={(m.telops ?? []).join("\n")} />
            <p className="text-xs text-stone-500">1行に1つ。</p>
          </MaterialSection>

          <div className="card flex flex-col items-start gap-3 bg-stone-900 text-white sm:flex-row sm:items-center">
            <p className="flex-1 text-sm">撮影・編集が終わったら、最終キャプションとサムネを編集長AIに完成報告しましょう。</p>
            <Link href={`/plans/${id}/report`} className="btn bg-white text-stone-900 hover:bg-stone-200">完成報告へ →</Link>
          </div>
        </>
      )}
    </div>
  );
}
