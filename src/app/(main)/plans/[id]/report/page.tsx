import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboardedAccount } from "@/lib/account";
import { reportCompletion } from "@/app/actions/plans";
import { ActionForm } from "@/components/ActionForm";
import type { Hashtags, Plan, Review } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

// S-07 完成報告
export default async function ReportPage({ params }: PageProps<"/plans/[id]/report">) {
  const { id } = await params;
  const { supabase, account } = await requireOnboardedAccount();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", id).eq("account_id", account.id).maybeSingle();
  // 見つからない（または別のアカウントの企画）ときは企画一覧へ
  if (!plan) redirect("/plans");
  const p = plan as Plan;

  const [{ data: materials }, { data: reports }] = await Promise.all([
    supabase.from("materials").select("caption, hashtags").eq("plan_id", id).maybeSingle(),
    supabase.from("completion_reports").select("*").eq("plan_id", id).order("created_at", { ascending: false }),
  ]);

  // 前回の報告があればその内容、無ければAIの素材を初期値にする
  const h = materials?.hashtags as Hashtags | null;
  const defaultCaption =
    reports?.[0]?.final_caption ??
    [materials?.caption ?? "", h ? [...h.large, ...h.medium, ...h.small].map((t) => "#" + t).join(" ") : ""].join("\n\n");

  // サムネは非公開保存なので、一時的に見られるURL（1時間有効）を作る
  const latest = reports?.[0];
  const review = latest?.review as Review | undefined;
  let thumbUrl: string | null = null;
  if (latest?.thumbnail_path) {
    const { data } = await supabase.storage.from("thumbnails").createSignedUrl(latest.thumbnail_path, 3600);
    thumbUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/plans/${id}/materials`} className="text-xs text-stone-500 underline">← 素材に戻る</Link>
        <h1 className="h1 mt-1">完成報告</h1>
        <p className="mt-1 text-sm text-stone-600">{p.title}</p>
      </div>

      <section className="card">
        <ActionForm
          action={reportCompletion}
          className="space-y-4"
          progressSteps={["サムネを保存しています…", "編集長AIがキャプションとサムネをチェックしています…", "確認事項をまとめています…"]}
        >
          <input type="hidden" name="plan_id" value={id} />
          <div>
            <label className="label" htmlFor="final_caption">最終キャプション（ハッシュタグ込み）</label>
            <textarea id="final_caption" name="final_caption" rows={12} className="input" defaultValue={defaultCaption} />
          </div>
          <div>
            <label className="label" htmlFor="thumbnail">サムネ画像（任意・3.5MBまで）</label>
            <input id="thumbnail" name="thumbnail" type="file" accept="image/*" className="text-sm" />
          </div>
          <SubmitButton className="btn">編集長AIに完成報告する</SubmitButton>
        </ActionForm>
      </section>

      {review && (
        <section className={`card ${review.ok ? "border-emerald-300" : "border-amber-300"}`}>
          <h2 className="h2">{review.ok ? "✅ 予約投稿してOKです" : "📝 予約前に確認してください"}</h2>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row">
            {thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt="サムネ" className="h-48 w-36 shrink-0 rounded-lg object-cover" />
            )}
            <div className="text-sm">
              <p>{review.summary}</p>
              <ul className="mt-3 space-y-1">
                {review.checklist.map((c, i) => (
                  <li key={i} className="flex gap-2"><span>☐</span><span>{c}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
            次は、InstagramアプリまたはMeta Business Suiteで予約投稿してください。公開されたら
            <Link href="/posts" className="mx-1 underline">投稿の紐付け</Link>
            で企画と結びつけます。
          </div>
        </section>
      )}
    </div>
  );
}
