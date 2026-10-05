import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { AccountSwitcher } from "@/components/AccountSwitcher";

// AI生成は時間がかかるので、このグループの画面から呼ぶ処理の最大時間を延ばす（秒）
export const maxDuration = 120;

const NAV = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/plans", label: "企画" },
  { href: "/posts", label: "投稿" },
  { href: "/reports", label: "レポート" },
  { href: "/settings", label: "設定" },
];

// ログイン後の共通レイアウト（ヘッダー：各画面・設定・通知へのリンク）
export default async function MainLayout({ children }: LayoutProps<"/">) {
  const { supabase, account, accounts } = await requireOnboardedAccount();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id)
    .is("read_at", null);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        {/* スマホなど幅が狭いときは、メニューを2段目に回す（flex-wrap と order-last） */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
          <Link href="/dashboard" className="shrink-0 font-bold">📸 運用AI</Link>
          <AccountSwitcher current={account} accounts={accounts} />
          <nav className="order-last flex w-full gap-4 overflow-x-auto whitespace-nowrap text-stone-600 sm:order-none sm:w-auto sm:gap-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-stone-900">{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link href="/notifications" className="relative" aria-label="通知">
              🔔
              {!!count && (
                <span className="absolute -right-2 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{count}</span>
              )}
            </Link>
            <form action="/auth/signout" method="post">
              <button className="text-xs text-stone-500 underline">ログアウト</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">{children}</main>
    </>
  );
}
