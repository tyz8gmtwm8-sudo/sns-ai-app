// エージェントに渡す「アカウント情報」の文章を作る共通関数
import type { Account } from "@/lib/types";

export function describeAccount(account: Account): string {
  const genres = account.genres.map((g) => (g === "その他" && account.genre_other ? account.genre_other : g));
  const p = account.policy;
  const lines = [`ジャンル: ${genres.join("、") || "未設定"}`];
  if (p) {
    lines.push(
      `ターゲット: ${p.target}`,
      `地域: ${p.region}`,
      `目的: ${p.purpose}`,
      `世界観・トーン: ${p.worldview}`,
      `フォロワー数: ${p.followers ?? "不明"}`,
      `投稿頻度: ${p.post_frequency}`,
      `競合: ${p.competitors.map((c) => "@" + c).join("、") || "なし"}`,
      `メモ: ${p.notes || "なし"}`,
    );
  }
  return lines.join("\n");
}

export function today(): string {
  return new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "full" });
}
