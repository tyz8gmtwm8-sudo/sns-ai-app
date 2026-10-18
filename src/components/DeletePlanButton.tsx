"use client";
// 企画の削除ボタン。間違えて消さないように、押したときに確認を出す
import { deletePlan } from "@/app/actions/plans";
import { SubmitButton } from "@/components/SubmitButton";

export function DeletePlanButton({ planId, className = "" }: { planId: string; className?: string }) {
  return (
    <form
      action={deletePlan}
      onSubmit={(e) => {
        // 「キャンセル」を押したら送信を止める
        if (!confirm("この企画を削除しますか？\nキャプションなどの素材や完成報告も一緒に消え、元に戻せません。")) e.preventDefault();
      }}
      className={className}
    >
      <input type="hidden" name="plan_id" value={planId} />
      <SubmitButton className="btn-outline px-3 py-1 text-xs text-red-700">削除</SubmitButton>
    </form>
  );
}
