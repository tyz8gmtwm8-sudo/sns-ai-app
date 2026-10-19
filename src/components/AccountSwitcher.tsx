// アカウント切り替えメニュー（ヘッダーに表示）
// 表示名はサーバー側で用意して、開閉や「切り替え中…」の表示はAccountMenu（ブラウザ側）に任せる
import { AccountMenu, type AccountMenuItem } from "@/components/AccountMenu";
import { accountLabel } from "@/lib/account";
import type { Account } from "@/lib/types";

const toItem = (a: Account): AccountMenuItem => ({ id: a.id, label: accountLabel(a), onboarded: a.onboarded });

export function AccountSwitcher({ current, accounts }: { current: Account; accounts: Account[] }) {
  return <AccountMenu current={toItem(current)} items={accounts.map(toItem)} />;
}
