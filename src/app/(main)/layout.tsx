import { requireOnboardedAccount } from "@/lib/account";
import { Sidebar } from "@/components/Sidebar";

// AI生成は時間がかかるので、このグループの画面から呼ぶ処理の最大時間を延ばす（秒）
export const maxDuration = 300;

// ログイン後の共通レイアウト（パソコンは左にメニュー、スマホは上にメニュー）
export default async function MainLayout({ children }: LayoutProps<"/">) {
  const { supabase, account, accounts } = await requireOnboardedAccount();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id)
    .is("read_at", null);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar account={account} accounts={accounts} unread={count ?? 0} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
