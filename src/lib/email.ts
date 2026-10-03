// メール送信（Resend というメール送信サービスのAPIを使う）
// APIキーは環境変数 RESEND_API_KEY から読み込み、ブラウザには出さない
import { headers } from "next/headers";

// 送信元アドレス。独自ドメインを登録するまでは、Resendのテスト用アドレスを使う
const FROM = process.env.RESEND_FROM || "Instagram運用AI <onboarding@resend.dev>";

export type EmailResult = { ok: true } | { ok: false; skipped?: boolean; error: string };

/** メールを1通送る。失敗しても例外は投げず、結果を返す */
export async function sendEmail(mail: { to: string; subject: string; html: string }): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, error: "RESEND_API_KEY が設定されていません" };

  try {
    // Resend の「メール送信API」にリクエストを送る
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, html: mail.html }),
    });
    if (!res.ok) {
      // 失敗したときは、Resend が返したエラー内容をそのまま伝える
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `メール送信に失敗しました（${res.status}）: ${body.message ?? res.statusText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `メール送信に失敗しました: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** メール本文に入れるリンク用に、アプリのURLを求める */
export async function getAppUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // 環境変数が無ければ、今アクセスされているURLから求める
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`;
  } catch {
    // 定期実行などリクエストが無い場面では headers() が使えない
  }
  return "http://localhost:3000";
}

/** HTMLに文字を入れるときに、< や > などを安全な形に変える */
export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** 通知メールの見た目（シンプルなHTML） */
export function notificationEmailHtml(n: { title: string; body?: string; url: string }) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;color:#2b2522">
  <p style="font-size:13px;color:#888">📸 Instagram運用AI</p>
  <h1 style="font-size:20px">${escapeHtml(n.title)}</h1>
  ${n.body ? `<p style="font-size:15px;line-height:1.7">${escapeHtml(n.body)}</p>` : ""}
  <p style="margin-top:24px"><a href="${escapeHtml(n.url)}" style="background:#2b2522;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none">アプリで見る</a></p>
  <p style="font-size:12px;color:#aaa;margin-top:32px">このメールが不要な場合は、アプリの「設定」→「通知」からオフにできます。</p>
</div>`;
}
