"use server";
// Instagram連携に関するServer Action
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedAccount } from "@/lib/account";
import { toErrorState, type ActionState } from "@/lib/action-state";
import { encrypt } from "@/lib/crypto";
import { listInstagramPages } from "@/lib/instagram/graph";
import { PENDING_COOKIE, readPending } from "@/lib/instagram/oauth";
import { analyzeCompetitors, syncInstagram } from "@/lib/instagram/sync";

/** 連携するFacebookページ（＝Instagramアカウント）を決める */
export async function chooseIgPage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pageId = String(formData.get("page_id") ?? "");
  try {
    const ctx = await requireOnboardedAccount();
    const pending = await readPending();
    if (!pending || pending.accountId !== ctx.account.id) {
      return { error: "連携の途中情報が見つかりません。もう一度「Instagramと連携する」を押してください" };
    }

    // ページ用トークンは、ここで改めて取得して暗号化して保存する
    const page = (await listInstagramPages(pending.userToken)).find((p) => p.pageId === pageId);
    if (!page) return { error: "選んだページが見つかりません" };

    const { error } = await ctx.supabase.from("ig_connections").upsert(
      {
        user_id: ctx.userId,
        account_id: ctx.account.id,
        page_id: page.pageId,
        page_name: page.pageName,
        ig_user_id: page.igUserId,
        ig_username: page.igUsername,
        page_token_enc: encrypt(page.pageToken),
        user_token_expires_at: pending.expiresAt,
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
    if (error) {
      if (error.code === "23505") return { error: "このInstagramは、すでに別のアカウントで連携されています" };
      throw new Error(error.message);
    }
    await ctx.supabase
      .from("accounts")
      .update({ ig_user_id: page.igUserId, ig_username: page.igUsername })
      .eq("id", ctx.account.id);
    (await cookies()).delete(PENDING_COOKIE);

    // 連携できたら、すぐに投稿とインサイトを取得する
    await syncInstagram({ ...ctx, account: { ...ctx.account, ig_user_id: page.igUserId } });
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  redirect("/posts");
}

/** 連携を解除する */
export async function disconnectInstagram() {
  const { supabase, account } = await requireOnboardedAccount();
  await supabase.from("ig_connections").delete().eq("account_id", account.id);
  await supabase.from("accounts").update({ ig_user_id: null, ig_username: null }).eq("id", account.id);
  revalidatePath("/", "layout");
}

/** 今すぐInstagramからデータを取得する */
export async function syncNow(): Promise<ActionState> {
  try {
    const ctx = await requireOnboardedAccount();
    const r = await syncInstagram(ctx);
    revalidatePath("/", "layout");
    if (r.skipped) return { error: "Instagramと連携していません。設定画面から連携してください" };
    return {
      message: `投稿${r.posts}件・インサイト${r.insights}件を取得しました${r.suggested ? `。紐付け候補が${r.suggested}件あります` : ""}`,
    };
  } catch (e) {
    return toErrorState(e);
  }
}

/** 今すぐ競合分析をする */
export async function runCompetitorAnalysis(): Promise<ActionState> {
  let reportId: string | undefined;
  try {
    const ctx = await requireOnboardedAccount();
    reportId = await analyzeCompetitors(ctx);
  } catch (e) {
    return toErrorState(e);
  }
  revalidatePath("/", "layout");
  redirect(reportId ? `/reports?id=${reportId}` : "/reports");
}
