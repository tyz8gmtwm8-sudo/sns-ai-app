"use server";
// 企画・素材・完成報告・タスクに関するServer Action
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedAccount, requireUser } from "@/lib/account";
import { toErrorState, type ActionState } from "@/lib/action-state";
import { adoptPlan, proposePlans, regenerateMaterial, revisePlan, submitCompletion, type RegenTarget } from "@/lib/workflows";
import type { Bgm, Cut } from "@/lib/types";

// ---------- S-05 企画 ----------
export async function generatePlans(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireOnboardedAccount();
    await proposePlans(ctx, {
      instruction: String(formData.get("instruction") ?? "").trim() || undefined,
      ideaIds: formData.getAll("idea_ids").map(String).filter(Boolean),
    });
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  redirect("/plans");
}

export async function adopt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get("plan_id"));
  try {
    const ctx = await requireOnboardedAccount();
    await adoptPlan(ctx, planId);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  redirect(`/plans/${planId}/materials`);
}

/** 企画案を1件だけ、指示どおりに修正する */
export async function revise(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get("plan_id"));
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) return { error: "どう直してほしいかを入力してください" };
  try {
    const ctx = await requireOnboardedAccount();
    await revisePlan(ctx, planId, instruction);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/plans");
  return { message: "修正しました" };
}

/**
 * 企画を削除する
 * 素材・完成報告・タスクはデータベースの設定で一緒に消える。投稿は残り、企画とのつながりだけ外れる
 */
export async function deletePlan(formData: FormData) {
  const planId = String(formData.get("plan_id"));
  const { supabase, account } = await requireOnboardedAccount();

  // 完成報告で保存したサムネ画像は自動では消えないので、先に消しておく
  const { data: reports } = await supabase.from("completion_reports").select("thumbnail_path").eq("plan_id", planId);
  const paths = (reports ?? []).map((r) => r.thumbnail_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("thumbnails").remove(paths);

  // 別のアカウントの企画は消せないように、アカウントIDも条件に入れる
  await supabase.from("plans").delete().eq("id", planId).eq("account_id", account.id);
  revalidatePath("/", "layout");
  redirect("/plans");
}

// ---------- S-06 素材の編集・再生成 ----------
export async function saveMaterial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get("plan_id"));
  const target = String(formData.get("target")) as RegenTarget;
  const lines = (k: string) =>
    String(formData.get(k) ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  const tags = (k: string) =>
    String(formData.get(k) ?? "")
      .split(/[\s,、]+/)
      .map((s) => s.replace(/^#/, ""))
      .filter(Boolean);

  let update: Record<string, unknown>;
  switch (target) {
    case "caption":
      update = { caption: String(formData.get("caption") ?? "") };
      break;
    case "hashtags":
      update = { hashtags: { large: tags("large"), medium: tags("medium"), small: tags("small") } };
      break;
    case "telops":
      update = { telops: lines("telops") };
      break;
    case "bgm": {
      const names = formData.getAll("bgm_name").map(String);
      const bgm: Bgm[] = names
        .map((name, i) => ({
          name: name.trim(),
          artist: String(formData.getAll("bgm_artist")[i] ?? ""),
          source: String(formData.getAll("bgm_source")[i]) === "free" ? ("free" as const) : ("instagram" as const),
          reason: String(formData.getAll("bgm_reason")[i] ?? ""),
        }))
        .filter((b) => b.name);
      update = { bgm };
      break;
    }
    case "structure": {
      const starts = formData.getAll("cut_start").map(Number);
      const cuts: Cut[] = starts.map((start, i) => ({
        start,
        end: Number(formData.getAll("cut_end")[i]),
        scene: String(formData.getAll("cut_scene")[i] ?? ""),
        shot: String(formData.getAll("cut_shot")[i] ?? ""),
        telop: String(formData.getAll("cut_telop")[i] ?? ""),
      })).filter((c) => c.scene || c.shot);
      update = { reel_structure: cuts, shot_list: lines("shot_list") };
      break;
    }
    default:
      return { error: "不明な項目です" };
  }

  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("materials")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("plan_id", planId);
    if (error) throw new Error(error.message);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath(`/plans/${planId}/materials`);
  return { message: "保存しました" };
}

export async function regenerate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get("plan_id"));
  const target = String(formData.get("target")) as RegenTarget;
  const instruction = String(formData.get("instruction") ?? "").trim() || "もっと良くしてください";
  try {
    const ctx = await requireOnboardedAccount();
    await regenerateMaterial(ctx, planId, target, instruction);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath(`/plans/${planId}/materials`);
  return { message: "作り直しました" };
}

// ---------- S-07 完成報告 ----------
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

export async function reportCompletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get("plan_id"));
  const finalCaption = String(formData.get("final_caption") ?? "").trim();
  const file = formData.get("thumbnail");
  if (!finalCaption) return { error: "最終キャプションを入力してください" };

  try {
    const ctx = await requireOnboardedAccount();
    let thumbnail: Parameters<typeof submitCompletion>[3];

    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) return { error: "サムネは画像ファイルを選んでください" };
      if (file.size > MAX_IMAGE_BYTES) return { error: "画像は3.5MB以下にしてください" };

      // Storageに保存（パスの先頭をユーザーIDにすると、本人だけがアクセスできる）
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${ctx.userId}/${planId}-${Date.now()}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error } = await ctx.supabase.storage.from("thumbnails").upload(path, bytes, { contentType: file.type });
      if (error) throw new Error(`サムネの保存に失敗しました: ${error.message}`);
      thumbnail = { path, image: { mimeType: file.type, base64: bytes.toString("base64") } };
    }

    await submitCompletion(ctx, planId, finalCaption, thumbnail);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  return { message: "編集長AIのチェックが完了しました" };
}

// ---------- タスク ----------
export async function toggleTask(formData: FormData) {
  const id = String(formData.get("task_id"));
  const done = formData.get("done") === "true";
  const { supabase } = await requireUser();
  await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo", done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/", "layout");
}
