import Link from "next/link";
import { accountLabel, requireOnboardedAccount } from "@/lib/account";
import { chooseIgPage } from "@/app/actions/instagram";
import { ActionForm } from "@/components/ActionForm";
import { listInstagramPages, type PageCandidate } from "@/lib/instagram/graph";
import { readPending } from "@/lib/instagram/oauth";
import { SubmitButton } from "@/components/SubmitButton";

// Instagram連携：つなぐページ（Instagramアカウント）を選ぶ画面
export default async function ChooseInstagramPage() {
  const { account } = await requireOnboardedAccount();
  const pending = await readPending();

  let pages: PageCandidate[] = [];
  let error = "";
  if (!pending || pending.accountId !== account.id) {
    error = "連携の途中情報が見つかりません（15分で期限が切れます）。設定画面から、もう一度「Instagramと連携する」を押してください。";
  } else {
    try {
      pages = await listInstagramPages(pending.userToken);
    } catch (e) {
      error = e instanceof Error ? e.message : "ページ一覧を取得できませんでした";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="text-xs text-stone-500 underline">← 設定に戻る</Link>
        <h1 className="h1 mt-1">連携するInstagramを選ぶ</h1>
        <p className="mt-1 text-sm text-stone-600">「{accountLabel(account)}」とつなぐInstagramアカウントを選んでください。</p>
      </div>

      {error ? (
        <p className="card text-sm text-red-600">⚠️ {error}</p>
      ) : pages.length === 0 ? (
        <div className="card space-y-2 text-sm text-stone-700">
          <p className="font-semibold">Instagramとつながっているfacebookページが見つかりませんでした。</p>
          <ul className="list-disc pl-5">
            <li>FacebookページとInstagram（プロアカウント）がリンクされているか確認してください。</li>
            <li>Facebookの許可画面で、そのページとInstagramアカウントにチェックを入れたか確認してください。</li>
          </ul>
        </div>
      ) : (
        <ActionForm action={chooseIgPage} className="space-y-3" progressSteps={["連携しています…", "投稿とインサイトを取得しています…", "もう少しです…"]}>
          {pages.map((p, i) => (
            <label key={p.pageId} className="card flex cursor-pointer items-center gap-3 has-[:checked]:border-stone-900">
              <input type="radio" name="page_id" value={p.pageId} defaultChecked={i === 0} />
              <div>
                <p className="font-semibold">@{p.igUsername}</p>
                <p className="text-xs text-stone-500">Facebookページ：{p.pageName}</p>
              </div>
            </label>
          ))}
          <SubmitButton className="btn">このInstagramと連携する</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
