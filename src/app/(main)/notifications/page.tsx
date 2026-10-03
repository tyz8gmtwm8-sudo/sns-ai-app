import Link from "next/link";
import { requireOnboardedAccount } from "@/lib/account";
import { markAllRead } from "@/app/actions/posts";

// 通知一覧
export default async function NotificationsPage() {
  const { supabase, account } = await requireOnboardedAccount();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="h1">通知</h1>
        <form action={markAllRead}><button className="btn-outline">すべて既読にする</button></form>
      </div>
      {!notifications?.length ? (
        <p className="text-sm text-stone-500">通知はありません。</p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
          {notifications.map((n) => (
            <li key={n.id} className={`px-4 py-3 text-sm ${n.read_at ? "text-stone-500" : ""}`}>
              <Link href={n.link ?? "/dashboard"} className="block hover:underline">
                {!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-500" />}
                <span className="font-medium">{n.title}</span>
                {n.body && <span> — {n.body}</span>}
                <span className="ml-2 text-xs text-stone-400">
                  {new Date(n.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
