// Facebookで許可した後に戻ってくる場所。トークンを受け取り、ページ選択画面へ進む
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCodeForLongLivedToken } from "@/lib/instagram/graph";
import { STATE_COOKIE, callbackUrl, savePending } from "@/lib/instagram/oauth";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const fail = (msg: string) => NextResponse.redirect(`${origin}/settings?ig_error=${encodeURIComponent(msg)}`);

  // 許可せずに戻ってきた場合
  if (searchParams.get("error")) return fail("Facebookで連携が許可されませんでした");

  const cookieStore = await cookies();
  const saved = cookieStore.get(STATE_COOKIE)?.value ?? "";
  cookieStore.delete(STATE_COOKIE);
  const [state, accountId] = saved.split(".");
  if (!state || state !== searchParams.get("state") || !accountId) {
    return fail("連携の確認に失敗しました。もう一度「Instagramと連携する」を押してください");
  }

  const code = searchParams.get("code");
  if (!code) return fail("Facebookからの応答が不正です");

  try {
    const { userToken, expiresAt } = await exchangeCodeForLongLivedToken(code, callbackUrl(origin));
    await savePending({ accountId, userToken, expiresAt });
    return NextResponse.redirect(`${origin}/settings/instagram`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "トークンの取得に失敗しました");
  }
}
