// メニュー。パソコンでは画面の左に縦に並べ、スマホでは画面の上に横に並べる
// 「投稿の流れ」は使う順番に番号を付けて、次に何をすればいいか分かるようにする
import Link from "next/link";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { NavLink } from "@/components/NavLink";
import { SubmitButton } from "@/components/SubmitButton";
import type { Account } from "@/lib/types";

const FLOW = [
  { href: "/ideas", label: "ネタ帳", no: "①", hint: "ネタを登録して投稿を作る" },
  { href: "/plans", label: "企画・素材", no: "②", hint: "キャプションや動画構成" },
  { href: "/posts", label: "投稿", no: "③", hint: "投稿と企画を紐付け" },
  { href: "/reports", label: "レポート", no: "④", hint: "結果の分析" },
];

// パソコン用のメニュー1行分の見た目
const ITEM = "w-full rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900";
const ACTIVE = "bg-stone-900 text-white hover:bg-stone-900 hover:text-white";

type Props = { account: Account; accounts: Account[]; unread: number };

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{count}</span>;
}

export function Sidebar({ account, accounts, unread }: Props) {
  return (
    <>
      {/* ---------- パソコン：左に固定 ---------- */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-stone-200 bg-white px-3 py-5 text-sm md:flex">
        <Link href="/dashboard" className="px-3 text-base font-bold">📸 運用AI</Link>
        <div className="px-3">
          <AccountSwitcher current={account} accounts={accounts} />
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink href="/dashboard" className={ITEM} activeClassName={ACTIVE}>🏠 ダッシュボード</NavLink>
          <p className="mt-4 px-3 text-xs font-semibold text-stone-400">投稿の流れ</p>
          {FLOW.map((n) => (
            <NavLink key={n.href} href={n.href} className={ITEM} activeClassName={ACTIVE}>
              <span className="w-5 text-center">{n.no}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{n.label}</span>
                <span className="text-[11px] opacity-60">{n.hint}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <nav className="mt-auto flex flex-col gap-1 border-t border-stone-100 pt-3">
          <NavLink href="/notifications" className={ITEM} activeClassName={ACTIVE}>
            🔔 <span className="flex-1">通知</span>
            <Badge count={unread} />
          </NavLink>
          <NavLink href="/settings" className={ITEM} activeClassName={ACTIVE}>⚙️ <span className="flex-1">設定</span></NavLink>
          <form action="/auth/signout" method="post">
            <SubmitButton className={`${ITEM} flex items-center gap-1.5 text-left text-stone-500`}>↩︎ ログアウト</SubmitButton>
          </form>
        </nav>
      </aside>

      {/* ---------- スマホ：上に横並び ---------- */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur md:hidden">
        <div className="flex items-center gap-3 px-4 py-3 text-sm">
          <Link href="/dashboard" className="shrink-0 font-bold">📸 運用AI</Link>
          <AccountSwitcher current={account} accounts={accounts} />
          <NavLink href="/notifications" className="ml-auto" activeClassName="font-bold">
            🔔<Badge count={unread} />
          </NavLink>
          <form action="/auth/signout" method="post">
            <SubmitButton className="flex items-center gap-1 text-xs text-stone-500 underline">ログアウト</SubmitButton>
          </form>
        </div>
        <nav className="flex gap-4 overflow-x-auto whitespace-nowrap px-4 pb-3 text-sm text-stone-600">
          <NavLink href="/dashboard" activeClassName="font-bold text-stone-900">ホーム</NavLink>
          {FLOW.map((n) => (
            <NavLink key={n.href} href={n.href} activeClassName="font-bold text-stone-900">{n.no}{n.label}</NavLink>
          ))}
          <NavLink href="/settings" activeClassName="font-bold text-stone-900">設定</NavLink>
        </nav>
      </header>
    </>
  );
}
