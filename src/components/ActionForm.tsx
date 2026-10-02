"use client";
// Server Action を実行するフォーム。
// 実行中は入力を無効にして進捗を表示し、エラーがあれば表示する。
import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";
import { Progress } from "./Progress";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  progressSteps?: string[]; // AI生成中に順番に表示するメッセージ
};

export function ActionForm({ action, children, className, progressSteps }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && progressSteps && <Progress steps={progressSteps} />}
      {state?.error && <p className="mt-2 text-sm text-red-600">⚠️ {state.error}</p>}
      {state?.message && !pending && <p className="mt-2 text-sm text-emerald-700">{state.message}</p>}
    </form>
  );
}
