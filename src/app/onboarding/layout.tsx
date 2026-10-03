import { getOrCreateAccount } from "@/lib/account";
import { AccountSwitcher } from "@/components/AccountSwitcher";

// AIヒアリングはAIの応答待ちがあるため、処理の最大時間を延ばす（秒）
export const maxDuration = 60;

// 初回設定画面のレイアウト。設定途中でも、他のアカウントに戻れるよう切り替えメニューを出す
export default async function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  const { account, accounts } = await getOrCreateAccount();
  return (
    <>
      {accounts.length > 1 && (
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-3 text-sm">
            <span className="font-bold">📸 運用AI</span>
            <AccountSwitcher current={account} accounts={accounts} />
          </div>
        </header>
      )}
      {children}
    </>
  );
}
