"use client";
// アカウント切り替えメニューの中身（ブラウザ側で動く部分）
// 押した瞬間にメニューを閉じて「切り替え中…」と表示し、反応したことがすぐ分かるようにする
// （useTransition：サーバーの処理が終わるまで「処理中」かどうかが分かるReactの機能）
import { useRef, useTransition } from "react";
import { addAccount, switchAccount } from "@/app/actions/account";

export type AccountMenuItem = { id: string; label: string; onboarded: boolean };

type Props = { current: AccountMenuItem; items: AccountMenuItem[] };

export function AccountMenu({ current, items }: Props) {
  const [pending, startTransition] = useTransition();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // サーバーの処理を呼ぶ前に、まずメニューを閉じる
  function run(action: () => Promise<void>) {
    if (detailsRef.current) detailsRef.current.open = false;
    startTransition(action);
  }

  function select(id: string) {
    // 今のアカウントを選んだときは何もしない（閉じるだけ）
    if (id === current.id) {
      if (detailsRef.current) detailsRef.current.open = false;
      return;
    }
    const formData = new FormData();
    formData.set("account_id", id);
    run(() => switchAccount(formData));
  }

  return (
    <details ref={detailsRef} className="relative shrink-0">
      <summary
        aria-busy={pending}
        className={`flex cursor-pointer list-none items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium hover:bg-stone-50 ${pending ? "pointer-events-none opacity-70" : ""}`}
      >
        {pending ? (
          <>
            <span className="spinner" aria-hidden />
            切り替え中…
          </>
        ) : (
          <>
            {current.label}
            {!current.onboarded && <span className="text-amber-700">（設定中）</span>}
            <span className="text-stone-400">▼</span>
          </>
        )}
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-60 rounded-xl border border-stone-200 bg-white p-2 text-sm shadow-lg">
        <p className="px-2 py-1 text-xs text-stone-500">アカウントを切り替え</p>
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={pending}
            onClick={() => select(a.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-stone-100 ${a.id === current.id ? "font-bold" : ""}`}
          >
            <span className="w-4">{a.id === current.id ? "✓" : ""}</span>
            <span className="flex-1">{a.label}</span>
            {!a.onboarded && <span className="text-xs text-amber-700">設定中</span>}
          </button>
        ))}
        <div className="mt-1 border-t border-stone-100 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => addAccount())}
            className="w-full rounded-lg px-2 py-2 text-left text-stone-700 hover:bg-stone-100"
          >
            ＋ アカウントを追加
          </button>
        </div>
      </div>
    </details>
  );
}
