// 通知を作る：アプリ内通知を保存し、設定がオンならメールでも送る（F-17）
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl, notificationEmailHtml, sendEmail } from "@/lib/email";

export async function notify(
  supabase: SupabaseClient,
  userId: string,
  accountId: string, // どのアカウントの通知か
  n: { title: string; body?: string; link?: string },
) {
  const { data: notification } = await supabase
    .from("notifications")
    .insert({ user_id: userId, account_id: accountId, ...n })
    .select("id")
    .single();

  // メール送信に失敗しても、アプリの処理（素材作成やレポート作成）は止めない
  try {
    const [{ data: profile }, { data: account }] = await Promise.all([
      supabase.from("profiles").select("email, notify_email").eq("id", userId).maybeSingle(),
      supabase.from("accounts").select("name, genres").eq("id", accountId).maybeSingle(),
    ]);
    if (!profile?.email || !profile.notify_email) return;

    // 複数アカウントを運用しているので、件名にどのアカウントの通知かを入れる
    const label = account?.name || account?.genres?.join("・") || "";
    const url = `${await getAppUrl()}${n.link ?? "/notifications"}`;
    const result = await sendEmail({
      to: profile.email,
      subject: label ? `【${label}】${n.title}` : n.title,
      html: notificationEmailHtml({ title: n.title, body: n.body, url }),
    });

    if (result.ok && notification) {
      await supabase.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", notification.id);
    } else if (!result.ok && !result.skipped) {
      console.error(result.error);
    }
  } catch (e) {
    console.error("通知メールの送信でエラー:", e);
  }
}
