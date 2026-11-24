"use server";
// お店の情報検索（キャプションに住所・営業時間などを差し込むため）
import { requireOnboardedAccount, requireUser } from "@/lib/account";
import { searchStores, type StoreInfo } from "@/lib/places";
import { findStoreInstagram } from "@/lib/agents/store-instagram";
import { getConnection } from "@/lib/instagram/sync";
import { fetchProfile, type IgProfile } from "@/lib/instagram/graph";
import { decrypt } from "@/lib/crypto";

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

export type InstagramSearchResult = {
  candidates?: {
    username: string;
    reason: string;
    // Instagram連携で確認できたときだけ入る（実在するビジネスアカウントの名前・自己紹介）
    profile: IgProfile | null;
  }[];
  // Instagram連携していて、実在確認ができる状態か
  canVerify?: boolean;
  error?: string;
};

/** Gemini（Google検索つき）で、お店のインスタの候補を探す */
export async function findInstagram(store: Pick<StoreInfo, "name" | "address" | "website">): Promise<InstagramSearchResult> {
  const { supabase, account } = await requireOnboardedAccount();
  try {
    const found = await findStoreInstagram({
      name: store.name.slice(0, 100),
      address: store.address.slice(0, 200),
      website: store.website?.slice(0, 300) ?? null,
    });
    if (!found.length) return { error: "インスタが見つかりませんでした。分かれば手で入力してください" };

    // Instagram連携していれば、候補のアカウントが本当にあるかを確かめる
    const conn = await getConnection(supabase, account.id);
    const active = conn?.status === "active" ? conn : null;
    const token = active ? decrypt(active.page_token_enc) : "";
    const candidates = await Promise.all(
      found.map(async (c) => ({
        ...c,
        profile: active ? await fetchProfile(active.ig_user_id, c.username, token) : null,
      })),
    );
    return { candidates, canVerify: !!active };
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : "インスタの検索に失敗しました" };
  }
}
