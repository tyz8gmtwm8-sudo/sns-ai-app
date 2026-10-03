// 「Instagramと連携する」ボタンの行き先。Facebookのログイン画面へ移動させる
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOnboardedAccount } from "@/lib/account";
import { buildLoginUrl } from "@/lib/instagram/graph";
import { STATE_COOKIE, callbackUrl } from "@/lib/instagram/oauth";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  try {
    const { account } = await requireOnboardedAccount();
    // 合言葉とアカウントIDをcookieに覚えておき、戻ってきたときに照合する
    const state = randomBytes(16).toString("hex");
    (await cookies()).set(STATE_COOKIE, `${state}.${account.id}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return NextResponse.redirect(buildLoginUrl(callbackUrl(origin), state));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "連携を開始できませんでした";
    return NextResponse.redirect(`${origin}/settings?ig_error=${encodeURIComponent(msg)}`);
  }
}
