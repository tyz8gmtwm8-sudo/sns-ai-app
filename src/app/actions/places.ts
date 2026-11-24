"use server";
// お店の情報検索（キャプションに住所・営業時間などを差し込むため）
import { requireUser } from "@/lib/account";
import { searchStores, type StoreInfo } from "@/lib/places";

export type StoreSearchResult = { stores?: StoreInfo[]; error?: string };

export async function findStores(query: string): Promise<StoreSearchResult> {
  // ログインしている人だけが使える（APIの料金を他人に使われないように）
  await requireUser();
  const q = query.trim();
  if (!q) return { error: "店名を入力してください" };
  if (q.length > 100) return { error: "100文字以内で入力してください" };
  try {
    const stores = await searchStores(q);
    if (!stores.length) return { error: "お店が見つかりませんでした。地域名（例：渋谷）も一緒に入れてみてください" };
    return { stores };
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : "お店の検索に失敗しました" };
  }
}
