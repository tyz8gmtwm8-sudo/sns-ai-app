import { getOrCreateAccount } from "@/lib/account";
import { HearingChat } from "./HearingChat";

const GREETING =
  "はじめまして！アカウントの方針づくりをお手伝いする、ヒアリング担当です😊\nいくつか質問させてください。まず、このアカウントは「どんな人」に見てほしいですか？（年齢や性別、好きなことなど）";

// S-03 AIヒアリング（画面2）
export default async function HearingPage() {
  const { supabase, userId, account } = await getOrCreateAccount();

  let { data: messages } = await supabase
    .from("hearing_messages")
    .select("id, role, content")
    .eq("account_id", account.id)
    .order("created_at");

  // 最初の挨拶を用意する
  if (!messages?.length) {
    const { data } = await supabase
      .from("hearing_messages")
      .insert({ user_id: userId, account_id: account.id, role: "assistant", content: GREETING })
      .select("id, role, content");
    messages = data;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <p className="text-xs text-stone-500">初回設定 2/2</p>
      <h1 className="h1 mt-1">AIヒアリング</h1>
      <p className="mt-2 text-sm text-stone-600">
        チャットで答えるだけで、アカウント方針をまとめます。最後に内容を確認して保存します。
      </p>
      <HearingChat initialMessages={messages ?? []} existingPolicy={account.policy} />
    </main>
  );
}
