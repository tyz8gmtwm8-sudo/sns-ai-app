"use client";
// ヒアリングのチャット画面
import { useActionState, useEffect, useRef } from "react";
import { sendHearingMessage, resetHearing, type HearingState } from "@/app/actions/account";
import { PolicyForm } from "@/components/PolicyForm";
import { Progress } from "@/components/Progress";
import type { Policy } from "@/lib/types";

type Message = { id: string; role: string; content: string };

export function HearingChat({ initialMessages, existingPolicy }: { initialMessages: Message[]; existingPolicy: Policy | null }) {
  const [state, formAction, pending] = useActionState<HearingState, FormData>(sendHearingMessage, null);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが来たら一番下までスクロールする
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [initialMessages.length, pending]);

  // 送信が成功したときだけ入力欄を空にする（エラー時は書いた文章を残す）
  useEffect(() => {
    if (!pending && state && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <div className="mt-6 flex flex-1 flex-col gap-4">
      <div className="card flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
        {initialMessages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
              m.role === "user" ? "self-end bg-stone-900 text-white" : "self-start bg-stone-100"
            }`}
          >
            {m.content}
          </div>
        ))}
        {pending && <Progress steps={["AIが回答を考えています…"]} />}
        <div ref={bottomRef} />
      </div>

      {state?.error && <p className="text-sm text-red-600">⚠️ {state.error}</p>}

      {state?.done && state.policy ? (
        <div className="card">
          <h2 className="h2">アカウント方針の確認</h2>
          <p className="mt-1 text-sm text-stone-600">内容を確認し、必要なら直してから保存してください。</p>
          <div className="mt-4">
            <PolicyForm policy={state.policy} next="/dashboard" submitLabel="この方針で保存してはじめる" />
          </div>
        </div>
      ) : (
        <form ref={formRef} action={formAction} className="flex gap-2">
          <textarea
            name="message"
            rows={2}
            className="input flex-1"
            placeholder="回答を入力（Shift+Enterで改行、Enterで送信）"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <button className="btn self-end" disabled={pending}>送信</button>
        </form>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-stone-500">
        <form action={resetHearing}>
          <button className="underline">ヒアリングを最初からやり直す</button>
        </form>
        {existingPolicy && <a href="/settings" className="underline">フォームで直接編集する</a>}
      </div>
    </div>
  );
}
