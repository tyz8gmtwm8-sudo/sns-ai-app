// Instagramのデータ取得と、それをもとにした自動処理
// ユーザーの操作（今すぐ取得）と、毎日の定期実行の両方から呼ばれる
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";
import { notify } from "@/lib/notify";
import { runAnalyst } from "@/lib/agents/analyst";
import { chiefSummarize } from "@/lib/agents/chief";
import { createReport } from "@/lib/workflows";
import type { Account } from "@/lib/types";
import {
  GraphError,
  fetchCompetitor,
  fetchMediaInsights,
  fetchRecentMedia,
  toPostType,
  type CompetitorData,
} from "./graph";

type Ctx = { supabase: SupabaseClient; userId: string; account: Account };

export type Connection = {
  id: string;
  ig_user_id: string;
  ig_username: string | null;
  page_name: string | null;
  page_token_enc: string;
  status: "active" | "error";
  last_error: string | null;
  last_synced_at: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

export async function getConnection(supabase: SupabaseClient, accountId: string) {
  const { data } = await supabase.from("ig_connections").select("*").eq("account_id", accountId).maybeSingle();
  return data as Connection | null;
}

/** トークン切れなどで連携が使えなくなったときの処理 */
async function markConnectionError(ctx: Ctx, conn: Connection, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const wasActive = conn.status === "active";
  await ctx.supabase
    .from("ig_connections")
    .update({ status: "error", last_error: message, updated_at: new Date().toISOString() })
    .eq("id", conn.id);
  // 何度も同じ通知を送らないよう、初めてエラーになったときだけ知らせる
  if (wasActive) {
    await notify(ctx.supabase, ctx.userId, ctx.account.id, {
      title: "Instagram連携が切れました",
      body: "設定画面から、もう一度「Instagramと連携する」を押してください。それまではスクショ読み取りで数値を取り込めます。",
      link: "/settings",
    });
  }
}

// ---------- 1. 投稿とインサイトの取得（F-05） ----------
export async function syncInstagram(ctx: Ctx) {
  const { supabase, userId, account } = ctx;
  const conn = await getConnection(supabase, account.id);
  if (!conn) return { skipped: true as const };

  const token = decrypt(conn.page_token_enc);
  let media;
  try {
    media = await fetchRecentMedia(conn.ig_user_id, token);
  } catch (e) {
    if (e instanceof GraphError && e.code === 190) await markConnectionError(ctx, conn, e);
    throw e;
  }

  // ストーリーズは対象外（24時間で消えるため）
  media = media.filter((m) => m.media_product_type !== "STORY");

  // 投稿を保存（すでにある投稿は内容だけ更新。企画との紐付けは消さない）
  if (media.length) {
    const { error } = await supabase.from("posts").upsert(
      media.map((m) => ({
        user_id: userId,
        account_id: account.id,
        ig_media_id: m.id,
        media_type: toPostType(m),
        permalink: m.permalink ?? null,
        caption: m.caption ?? null,
        posted_at: m.timestamp,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      })),
      { onConflict: "account_id,ig_media_id" },
    );
    if (error) throw new Error(`投稿の保存に失敗しました: ${error.message}`);
  }

  // 30日以内の投稿だけ、インサイトを取得する（APIの呼び出し回数を抑えるため）
  const { data: posts } = await supabase
    .from("posts")
    .select("id, ig_media_id")
    .eq("account_id", account.id)
    .not("ig_media_id", "is", null);
  const idByMedia = new Map((posts ?? []).map((p) => [p.ig_media_id as string, p.id as string]));
  const recent = media.filter((m) => Date.now() - new Date(m.timestamp).getTime() < 30 * DAY);

  let insightCount = 0;
  for (const m of recent) {
    const postId = idByMedia.get(m.id);
    if (!postId) continue;
    let values;
    try {
      const i = await fetchMediaInsights(m.id, token);
      values = { likes: i.likes ?? m.like_count ?? null, comments: i.comments ?? m.comments_count ?? null, reach: i.reach, saves: i.saved, shares: i.shares, plays: i.views };
    } catch {
      // インサイトが取れない投稿（古い投稿など）は、いいね・コメントだけ保存する
      values = { likes: m.like_count ?? null, comments: m.comments_count ?? null, reach: null, saves: null, shares: null, plays: null };
    }
    await supabase.from("insights").insert({ user_id: userId, post_id: postId, source: "api", ...values });
    insightCount++;
  }

  await supabase
    .from("ig_connections")
    .update({ status: "active", last_error: null, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", conn.id);

  const suggested = await suggestLinks(ctx);
  return { skipped: false as const, posts: media.length, insights: insightCount, suggested };
}

// ---------- 2. 新しい投稿と企画の紐付け候補（F-15） ----------

/** 比べやすいよう、空白・ハッシュタグ・記号を取り除く */
function normalize(text: string) {
  return text.replace(/#\S+/g, "").replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 2つの文章がどのくらい似ているか（0〜1）。2文字ずつの組み合わせの重なりで計算する */
function similarity(a: string, b: string) {
  const grams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ga = grams(normalize(a));
  const gb = grams(normalize(b));
  if (!ga.size || !gb.size) return 0;
  let common = 0;
  ga.forEach((g) => gb.has(g) && common++);
  return (2 * common) / (ga.size + gb.size);
}

async function suggestLinks(ctx: Ctx) {
  const { supabase, userId, account } = ctx;
  // 完成報告済みで、まだ投稿と結びついていない企画
  const { data: plans } = await supabase.from("plans").select("id, title").eq("account_id", account.id).eq("status", "reported");
  if (!plans?.length) return 0;

  const { data: reports } = await supabase
    .from("completion_reports")
    .select("plan_id, final_caption, created_at")
    .in("plan_id", plans.map((p) => p.id))
    .order("created_at", { ascending: false });
  const { data: posts } = await supabase
    .from("posts")
    .select("id, caption, posted_at")
    .eq("account_id", account.id)
    .eq("link_status", "unlinked")
    .not("caption", "is", null);

  let count = 0;
  for (const post of posts ?? []) {
    // 完成報告より後に投稿されたもののうち、キャプションが一番似ている企画を探す
    let best: { planId: string; score: number } | null = null;
    for (const r of reports ?? []) {
      if (post.posted_at && new Date(post.posted_at).getTime() < new Date(r.created_at).getTime() - DAY) continue;
      const score = similarity(post.caption!, r.final_caption);
      if (!best || score > best.score) best = { planId: r.plan_id, score };
    }
    if (best && best.score >= 0.5) {
      await supabase.from("posts").update({ plan_id: best.planId, link_status: "suggested" }).eq("id", post.id);
      const title = plans.find((p) => p.id === best!.planId)?.title;
      await notify(supabase, userId, account.id, {
        title: "新しい投稿を検知しました",
        body: `企画「${title}」の投稿のようです。紐付けを確認してください。`,
        link: "/posts",
      });
      count++;
    }
  }
  return count;
}

// ---------- 3. 競合分析（F-07） ----------

/** 競合の投稿を、投稿種類ごとに集計する */
function summarizeCompetitor(c: CompetitorData) {
  const byType: Record<string, { count: number; likes: number; comments: number }> = {};
  for (const m of c.media) {
    const type = toPostType({ media_type: m.media_type as "IMAGE", media_product_type: m.media_product_type as "FEED" });
    byType[type] ??= { count: 0, likes: 0, comments: 0 };
    byType[type].count++;
    byType[type].likes += m.like_count ?? 0;
    byType[type].comments += m.comments_count ?? 0;
  }
  const times = c.media.map((m) => new Date(m.timestamp).getTime()).sort();
  const weeks = times.length > 1 ? Math.max((times[times.length - 1] - times[0]) / (7 * DAY), 1) : 1;
  return {
    username: c.username,
    followers: c.followers_count ?? null,
    analyzed_posts: c.media.length,
    posts_per_week: Math.round((c.media.length / weeks) * 10) / 10,
    by_post_type: Object.fromEntries(
      Object.entries(byType).map(([type, v]) => [
        type,
        { posts: v.count, avg_likes: Math.round(v.likes / v.count), avg_comments: Math.round(v.comments / v.count) },
      ]),
    ),
  };
}

export async function analyzeCompetitors(ctx: Ctx) {
  const { supabase, userId, account } = ctx;
  const conn = await getConnection(supabase, account.id);
  if (!conn) throw new Error("競合分析にはInstagram連携が必要です。設定画面から連携してください");

  const { data: competitors } = await supabase.from("competitors").select("username").eq("account_id", account.id);
  if (!competitors?.length) throw new Error("競合アカウントが登録されていません。設定画面の「アカウント方針」に追加してください");

  const token = decrypt(conn.page_token_enc);
  const results = [];
  const failed: string[] = [];
  for (const { username } of competitors) {
    try {
      const data = await fetchCompetitor(conn.ig_user_id, username, token);
      await supabase.from("competitor_snapshots").insert({
        user_id: userId,
        account_id: account.id,
        username,
        followers_count: data.followers_count ?? null,
        media_count: data.media_count ?? null,
        media: data.media,
      });
      results.push(summarizeCompetitor(data));
    } catch (e) {
      // 個人アカウントや存在しないアカウントは取得できない
      const message = e instanceof Error ? e.message : String(e);
      await supabase.from("competitor_snapshots").insert({ user_id: userId, account_id: account.id, username, error: message });
      failed.push(username);
    }
  }
  if (!results.length) {
    throw new Error(`競合アカウントのデータを取得できませんでした（${failed.map((u) => "@" + u).join("、")}）。プロアカウントでないと取得できません`);
  }

  const kindLabel = "競合分析（ジャンルに有効な投稿種類と頻度の判断）";
  const analysis = await runAnalyst({ account, kindLabel, data: { competitors: results, could_not_fetch: failed } });
  const summary = await chiefSummarize(account, kindLabel, analysis);
  const { data: report } = await supabase
    .from("reports")
    .insert({ user_id: userId, account_id: account.id, kind: "competitor", analysis, summary })
    .select("id")
    .single();
  await notify(supabase, userId, account.id, {
    title: "競合分析ができました",
    body: analysis.headline,
    link: report ? `/reports?id=${report.id}` : "/reports",
  });
  return report?.id as string | undefined;
}

// ---------- 4. 自動レポート（48時間後・7日後・週次）（F-16） ----------

/** 1回の実行で作るレポートの上限（AIの利用回数と処理時間を抑えるため。残りは翌日） */
const MAX_REPORTS_PER_RUN = 3;

export async function runScheduledReports(ctx: Ctx) {
  const { supabase, account } = ctx;
  const now = Date.now();
  const created: string[] = [];

  const { data: posts } = await supabase
    .from("posts")
    .select("id, posted_at, insights(id)")
    .eq("account_id", account.id)
    .gte("posted_at", new Date(now - 21 * DAY).toISOString());
  const { data: existing } = await supabase
    .from("reports")
    .select("post_id, kind, created_at")
    .eq("account_id", account.id)
    .gte("created_at", new Date(now - 30 * DAY).toISOString());
  const has = (postId: string, kind: string) => existing?.some((r) => r.post_id === postId && r.kind === kind);

  for (const post of posts ?? []) {
    if (created.length >= MAX_REPORTS_PER_RUN || !post.posted_at || !post.insights?.length) continue;
    const age = now - new Date(post.posted_at).getTime();
    // 7日後レポート（7〜21日の間）
    if (age >= 7 * DAY && !has(post.id, "post_7d")) {
      await createReport(ctx, "post_7d", post.id);
      created.push("post_7d");
      // 48時間後レポート（2〜7日の間。7日を過ぎたら7日後レポートだけにする）
    } else if (age >= 2 * DAY && age < 7 * DAY && !has(post.id, "post_48h")) {
      await createReport(ctx, "post_48h", post.id);
      created.push("post_48h");
    }
  }

  // 週次レポート：月曜日（日本時間）に、直近6日以内に作っていなければ作る
  const jstDay = new Date(now + 9 * 60 * 60 * 1000).getUTCDay();
  const weeklyDone = existing?.some((r) => r.kind === "weekly" && now - new Date(r.created_at).getTime() < 6 * DAY);
  if (jstDay === 1 && !weeklyDone && created.length < MAX_REPORTS_PER_RUN && posts?.length) {
    await createReport(ctx, "weekly");
    created.push("weekly");
  }
  return created;
}
