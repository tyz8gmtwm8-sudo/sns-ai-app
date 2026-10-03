// 毎日の定期実行（Vercel Cron から毎朝呼ばれる）
// 1. Instagramから投稿・インサイトを取得  2. 48時間後・7日後・週次レポート  3. 月曜は競合分析
// 失敗した場合は job_runs に記録してダッシュボードに表示し、翌日の実行で自動的にやり直す
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { analyzeCompetitors, getConnection, runScheduledReports, syncInstagram } from "@/lib/instagram/sync";
import type { Account } from "@/lib/types";

// 処理に時間がかかるので、最大実行時間を延ばす（秒）
export const maxDuration = 300;
// この時間を過ぎたら、残りのアカウントは翌日に回す（最大実行時間に余裕を持たせる）
const TIME_BUDGET_MS = 240 * 1000;

export async function GET(request: Request) {
  // Vercel Cron は「Authorization: Bearer <CRON_SECRET>」を付けて呼ぶ。それ以外からの呼び出しは断る
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const supabase = createAdminClient();
  const { data } = await supabase.from("accounts").select("*").eq("onboarded", true).order("created_at");
  const accounts = (data ?? []) as Account[];
  const isMonday = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay() === 1;
  const results: { account: string; status: string; detail: string }[] = [];

  for (const account of accounts) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      results.push({ account: account.id, status: "skipped", detail: "時間切れのため翌日に実行" });
      continue;
    }
    const ctx = { supabase, userId: account.user_id, account };
    const done: string[] = [];
    try {
      const conn = await getConnection(supabase, account.id);
      if (conn) {
        const r = await syncInstagram(ctx);
        if (!r.skipped) done.push(`投稿${r.posts}件・インサイト${r.insights}件を取得`);
      }
      const reports = await runScheduledReports(ctx);
      if (reports.length) done.push(`レポート${reports.length}件を作成`);
      if (isMonday && conn) {
        const { count } = await supabase.from("competitors").select("id", { count: "exact", head: true }).eq("account_id", account.id);
        if (count) {
          await analyzeCompetitors(ctx);
          done.push("競合分析を作成");
        }
      }
      const detail = done.join("、") || "対象なし";
      await supabase.from("job_runs").insert({ user_id: account.user_id, account_id: account.id, job: "daily", status: "success", detail });
      results.push({ account: account.id, status: "success", detail });
    } catch (e) {
      const detail = `${done.length ? done.join("、") + "の後に" : ""}エラー: ${e instanceof Error ? e.message : String(e)}`;
      console.error(`daily job failed for ${account.id}:`, e);
      await supabase.from("job_runs").insert({ user_id: account.user_id, account_id: account.id, job: "daily", status: "failed", detail });
      await notify(supabase, account.user_id, account.id, {
        title: "自動処理に失敗しました",
        body: `${detail}（翌日に自動で再実行します）`,
        link: "/dashboard",
      });
      results.push({ account: account.id, status: "failed", detail });
    }
  }

  return NextResponse.json({ ok: true, results });
}
