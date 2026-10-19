// 素材1項目分のカード（編集フォーム＋指示付き再生成＋コピー）
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { regenerate, saveMaterial } from "@/app/actions/plans";
import { InstructionInput } from "@/components/InstructionInput";
import type { RegenTarget } from "@/lib/workflows";
import { SubmitButton } from "@/components/SubmitButton";

// 項目ごとの、よく使う指示
const CHIPS: Record<RegenTarget, string[]> = {
  caption: ["もっと短く", "もっとカジュアルに", "もっと丁寧に", "フックを強く", "絵文字を増やす", "絵文字を減らす"],
  hashtags: ["地域タグを増やす", "小規模タグを増やす", "数を減らす"],
  bgm: ["もっと明るく", "もっと落ち着いた雰囲気", "トレンド寄りに"],
  structure: ["もっと短く（15秒）", "最初の1秒を強く", "撮影カットを減らす"],
  telops: ["もっと短く", "もっと話し言葉で"],
};

type Props = {
  planId: string;
  target: RegenTarget;
  title: string;
  copyText?: string;
  note?: React.ReactNode;
  children: React.ReactNode; // 編集フォームの中身
};

export function MaterialSection({ planId, target, title, copyText, note, children }: Props) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="h2">{title}</h2>
        {copyText && <CopyButton text={copyText} />}
      </div>
      {note}
      <ActionForm action={saveMaterial} className="mt-3 space-y-3">
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="target" value={target} />
        {children}
        <SubmitButton className="btn-outline">編集を保存</SubmitButton>
      </ActionForm>
      <ActionForm
        action={regenerate}
        className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row"
        progressSteps={["AIが作り直しています…", "もう少しです…"]}
      >
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="target" value={target} />
        <InstructionInput placeholder="（任意）再生成の指示 例：もっと短く、価格を強調して" chips={CHIPS[target]} />
        <SubmitButton className="btn shrink-0 self-start">再生成</SubmitButton>
      </ActionForm>
    </section>
  );
}
