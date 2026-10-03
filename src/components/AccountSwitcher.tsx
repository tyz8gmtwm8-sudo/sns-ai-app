// アカウント切り替えメニュー（ヘッダーに表示）
// <details> を使うと、JavaScriptを書かなくても開閉できるメニューになる
import { addAccount, switchAccount } from "@/app/actions/account";
import { accountLabel } from "@/lib/account";
import type { Account } from "@/lib/types";

export function AccountSwitcher({ current, accounts }: { current: Account; accounts: Account[] }) {
  return (
    <details className="relative shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium hover:bg-stone-50">
        {accountLabel(current)}
        {!current.onboarded && <span className="text-amber-700">（設定中）</span>}
        <span className="text-stone-400">▼</span>
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-60 rounded-xl border border-stone-200 bg-white p-2 text-sm shadow-lg">
        <p className="px-2 py-1 text-xs text-stone-500">アカウントを切り替え</p>
        {accounts.map((a) => (
          <form key={a.id} action={switchAccount}>
            <input type="hidden" name="account_id" value={a.id} />
            <button
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-stone-100 ${a.id === current.id ? "font-bold" : ""}`}
            >
              <span className="w-4">{a.id === current.id ? "✓" : ""}</span>
              <span className="flex-1">{accountLabel(a)}</span>
              {!a.onboarded && <span className="text-xs text-amber-700">設定中</span>}
            </button>
          </form>
        ))}
        <form action={addAccount} className="mt-1 border-t border-stone-100 pt-1">
          <button className="w-full rounded-lg px-2 py-2 text-left text-stone-700 hover:bg-stone-100">＋ アカウントを追加</button>
        </form>
      </div>
    </details>
  );
}
