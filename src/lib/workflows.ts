// 運用サイクルの処理：編集長AIが各AIを順に呼び出し、結果をDBに保存する
// （要件定義書 7章「運用サイクル」の 1〜7 に対応）
import type { SupabaseClient } from "@supabase/supabase-js";
import { runResearch } from "@/lib/agents/research";
import { runPlanner } from "@/lib/agents/planner";
import { runWriter } from "@/lib/agents/writer";
import { runVideo } from "@/lib/agents/video";
import { runAnalyst } from "@/lib/agents/analyst";
import { chiefMakeTasks, chiefReview, chiefSummarize, type TaskKind } from "@/lib/agents/chief";
import { notify } from "@/lib/notify";
import { REPORT_KIND_LABELS } from "@/lib/constants";
import type { ImageInput } from "@/lib/gemini";
import type { Account, ChiefSummary, Materials, Plan } from "@/lib/types";

type Ctx = { supabase: SupabaseClient; userId: string; account: Account };

// ---------- 1. 企画案を3件提案する ----------
export async function proposePlans(ctx: Ctx, instruction?: string) {
  const { supabase, userId, account } = ctx;

  // リサーチAIでネタ集め
  const research = await runResearch(account);
  const { data: memo } = await supabase
    .from("research_memos")
    .insert({ user_id: userId, account_id: account.id, content: research.text, sources: research.sources })
    .select("id")
    .single();

  // 競合分析と過去の改善案を集める
  const { data: reports } = await supabase
    .from("reports")
    .select("kind, analysis, summary")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const competitor = reports?.find((r) => r.kind === "competitor");
  const pastImprovements = (reports ?? [])
    .filter((r) => r.kind !== "competitor")
    .slice(0, 3)
    .flatMap((r) => (r.summary as ChiefSummary | null)?.improvements ?? [])
    .join("\n");

  // 企画AIで3件作る
  const result = await runPlanner({
    account,
    researchMemo: research.text,
    competitorSummary: competitor ? JSON.stringify(competitor.analysis) : "",
    pastImprovements,
    instruction,
  });

  // 前回の未採用の提案は「不採用」にしておく
  await supabase.from("plans").update({ status: "rejected" }).eq("account_id", account.id).eq("status", "proposed");

  const batchId = crypto.randomUUID();
  const { error } = await supabase.from("plans").insert(
    result.plans.map((p) => ({
      user_id: userId,
      account_id: account.id,
      batch_id: batchId,
      research_memo_id: memo?.id ?? null,
      recommendation: result.recommended_post_type,
      ...p,
    })),
  );
  if (error) throw new Error(`企画の保存に失敗しました: ${error.message}`);
  return batchId;
}

// ---------- 2〜3. 採用 → 素材作成 → 人間へのタスク指示 ----------
const TASK_LINKS: Record<TaskKind, (planId: string) => string> = {
  shoot: (id) => `/plans/${id}/materials`,
  edit: (id) => `/plans/${id}/materials`,
  report: (id) => `/plans/${id}/report`,
  schedule: (id) => `/plans/${id}/report`,
  link: () => "/posts",
  other: () => "/dashboard",
};

export async function adoptPlan(ctx: Ctx, planId: string) {
  const { supabase, userId, account } = ctx;
  const plan = await getPlan(supabase, account.id, planId);

  // 採用した企画以外の同じ回の提案は不採用にする
  await supabase.from("plans").update({ status: "rejected" }).eq("batch_id", plan.batch_id).neq("id", planId);
  await supabase.from("plans").update({ status: "adopted", adopted_at: new Date().toISOString() }).eq("id", planId);

  // 投稿作成AIと動画構成AIを同時に動かす（待ち時間を短くするため）
  const [written, video] = await Promise.all([runWriter({ account, plan }), runVideo({ account, plan })]);
  const materials = { ...written, ...video };

  const { error } = await supabase
    .from("materials")
    .upsert({ user_id: userId, plan_id: planId, ...materials, updated_at: new Date().toISOString() }, { onConflict: "plan_id" });
  if (error) throw new Error(`素材の保存に失敗しました: ${error.message}`);

  // 編集長AIが人間へのタスクを作る
  const { tasks } = await chiefMakeTasks(account, plan, materials);
  await supabase.from("tasks").insert(
    tasks.map((t, i) => ({
      user_id: userId,
      account_id: account.id,
      plan_id: planId,
      title: t.title,
      detail: t.detail,
      link: TASK_LINKS[t.kind]?.(planId) ?? "/dashboard",
      sort: i,
    })),
  );

  await supabase.from("plans").update({ status: "materials_ready" }).eq("id", planId);
  await notify(supabase, userId, account.id, {
    title: "素材ができました",
    body: `「${plan.title}」の素材と撮影タスクを用意しました。`,
    link: `/plans/${planId}/materials`,
  });
}

// ---------- 素材の一部を再生成する（F-12） ----------
export type RegenTarget = "caption" | "hashtags" | "bgm" | "telops" | "structure";

export async function regenerateMaterial(ctx: Ctx, planId: string, target: RegenTarget, instruction: string) {
  const { supabase, account } = ctx;
  const plan = await getPlan(supabase, account.id, planId);
  const { data: current } = await supabase.from("materials").select("*").eq("plan_id", planId).single();
  const focus = `${instruction}\n（今回は「${target}」だけを作り直します。他の項目は今の内容のままで構いません）`;

  let update: Partial<Materials>;
  if (target === "structure") {
    const v = await runVideo({ account, plan, current: current as Materials, instruction: focus });
    update = { reel_structure: v.reel_structure, shot_list: v.shot_list };
  } else {
    const w = await runWriter({ account, plan, current: current as Materials, instruction: focus });
    update = { [target]: w[target] };
  }
  await supabase.from("materials").update({ ...update, updated_at: new Date().toISOString() }).eq("plan_id", planId);
}

// ---------- 4. 完成報告のチェック ----------
export async function submitCompletion(
  ctx: Ctx,
  planId: string,
  finalCaption: string,
  thumbnail?: { path: string; image: ImageInput },
) {
  const { supabase, userId, account } = ctx;
  const plan = await getPlan(supabase, account.id, planId);
  const { data: materials } = await supabase.from("materials").select("*").eq("plan_id", planId).maybeSingle();

  const review = await chiefReview({
    account,
    plan,
    materials: materials as Materials | null,
    finalCaption,
    thumbnail: thumbnail?.image,
  });

  await supabase.from("completion_reports").insert({
    user_id: userId,
    plan_id: planId,
    final_caption: finalCaption,
    thumbnail_path: thumbnail?.path ?? null,
    review,
  });

  // 撮影・編集・完成報告タスクを完了にし、5〜6の「予約投稿」「紐付け」タスクを追加
  if (plan.status !== "reported" && plan.status !== "posted" && plan.status !== "done") {
    await supabase
      .from("tasks")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("plan_id", planId)
      .eq("status", "todo");
    await supabase.from("tasks").insert([
      {
        user_id: userId,
        account_id: account.id,
        plan_id: planId,
        title: "Instagramで予約投稿する",
        detail: "確認事項をチェックしてから、InstagramまたはMeta Business Suiteで予約投稿してください。",
        link: `/plans/${planId}/report`,
        sort: 0,
      },
      {
        user_id: userId,
        account_id: account.id,
        plan_id: planId,
        title: "公開された投稿を企画と紐付ける",
        detail: "投稿が公開されたら、投稿の紐付け画面で企画と結びつけてください。",
        link: "/posts",
        sort: 1,
      },
    ]);
    await supabase.from("plans").update({ status: "reported" }).eq("id", planId);
  }
  return review;
}

// ---------- 7. 分析レポート作成 ----------
export type ReportKind = "post_48h" | "post_7d" | "weekly";

export async function createReport(ctx: Ctx, kind: ReportKind, postId?: string) {
  const { supabase, userId, account } = ctx;
  const kindLabel = REPORT_KIND_LABELS[kind];

  // 分析に使うデータを集める
  const { data: posts } = await supabase
    .from("posts")
    .select("id, media_type, caption, posted_at, permalink, plan:plans(title, post_type, concept), insights(likes, comments, reach, saves, shares, plays, captured_at, source)")
    .eq("account_id", account.id)
    .order("posted_at", { ascending: false })
    .limit(20);

  let data: unknown;
  if (kind === "weekly") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    data = {
      this_week: (posts ?? []).filter((p) => p.posted_at && new Date(p.posted_at).getTime() >= weekAgo),
      earlier_posts_for_comparison: (posts ?? []).filter((p) => !p.posted_at || new Date(p.posted_at).getTime() < weekAgo),
    };
  } else {
    if (!postId) throw new Error("投稿を選んでください");
    data = {
      target_post: posts?.find((p) => p.id === postId),
      other_recent_posts: posts?.filter((p) => p.id !== postId),
    };
  }

  const analysis = await runAnalyst({ account, kindLabel, data });
  const summary = await chiefSummarize(account, kindLabel, analysis);

  const { data: report, error } = await supabase
    .from("reports")
    .insert({ user_id: userId, account_id: account.id, kind, post_id: postId ?? null, analysis, summary })
    .select("id")
    .single();
  if (error) throw new Error(`レポートの保存に失敗しました: ${error.message}`);

  // 7日後レポートで、その投稿の企画は「分析完了」
  if (kind === "post_7d" && postId) {
    const { data: post } = await supabase.from("posts").select("plan_id").eq("id", postId).single();
    if (post?.plan_id) await supabase.from("plans").update({ status: "done" }).eq("id", post.plan_id);
  }

  await notify(supabase, userId, account.id, {
    title: `${kindLabel}ができました`,
    body: analysis.headline,
    link: `/reports?id=${report.id}`,
  });
  return report.id as string;
}

// ---------- 共通 ----------
// 今選んでいるアカウントの企画だけを取得する
// （別のタブでアカウントを切り替えた後に、違うアカウントの方針で処理しないため）
async function getPlan(supabase: SupabaseClient, accountId: string, planId: string) {
  const { data, error } = await supabase.from("plans").select("*").eq("id", planId).eq("account_id", accountId).maybeSingle();
  if (error || !data) throw new Error("この企画は、今選んでいるアカウントのものではありません。画面上部でアカウントを確認してください。");
  return data as Plan;
}
