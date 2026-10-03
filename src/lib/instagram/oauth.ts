// Instagram連携（ログイン）で使う共通の値と、途中経過を一時保存するcookie
import { cookies } from "next/headers";
import { decrypt, encrypt } from "@/lib/crypto";

export const STATE_COOKIE = "ig_oauth_state"; // なりすまし防止の合言葉
export const PENDING_COOKIE = "ig_pending"; // ページを選ぶまでの一時保存（暗号化）

/** Metaに登録する「戻り先URL」。連携の最初と最後で完全に同じである必要がある */
export function callbackUrl(origin: string) {
  const base = (process.env.APP_URL || origin).replace(/\/$/, "");
  return `${base}/api/instagram/callback`;
}

export type Pending = { accountId: string; userToken: string; expiresAt: string | null };

export async function savePending(p: Pending) {
  (await cookies()).set(PENDING_COOKIE, encrypt(JSON.stringify(p)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // 15分だけ有効
  });
}

export async function readPending(): Promise<Pending | null> {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw)) as Pending;
  } catch {
    return null;
  }
}
