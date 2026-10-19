"use server";
// レポートに関するServer Action
import { revalidatePath } from "next/cache";
import { requireOnboardedAccount } from "@/lib/account";

/** レポートを開いたら「既読」にする（一覧でグレーに表示するため） */
export async function markReportRead(reportId: string) {
  const { supabase, account } = await requireOnboardedAccount();
  await supabase
    .from("reports")
    .update({ read_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("account_id", account.id)
    .is("read_at", null);
  revalidatePath("/reports");
}
