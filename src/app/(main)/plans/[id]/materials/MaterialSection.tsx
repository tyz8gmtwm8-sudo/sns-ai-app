// 素材1項目分のカード（編集フォーム＋指示付き再生成＋コピー）
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { regenerate, saveMaterial } from "@/app/actions/plans";
import type { RegenTarget } from "@/lib/workflows";

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
        <button className="btn-outline">編集を保存</button>
      </ActionForm>
      <ActionForm
        action={regenerate}
        className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row"
        progressSteps={["AIが作り直しています…", "もう少しです…"]}
      >
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="target" value={target} />
        <input name="instruction" className="input flex-1" placeholder="（任意）再生成の指示 例：もっと短く、価格を強調して" />
        <button className="btn shrink-0">再生成</button>
      </ActionForm>
    </section>
  );
}
