// Instagram API（Facebookログイン方式）とやり取りする関数（サーバー側専用）
// 仕様：https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login
const VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

// 連携のときにユーザーに許可をもらう権限
export const SCOPES = [
  "instagram_basic", // プロフィール・投稿一覧
  "instagram_manage_insights", // インサイト（リーチ・保存など）と競合の公開情報
  "pages_show_list", // Facebookページの一覧
  "pages_read_engagement", // ページ用トークンの取得
  "business_management", // ページがビジネスポートフォリオに入っている場合に必要
];

/** Metaから返ってきたエラー。code 190 はトークン切れ・無効 */
export class GraphError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

function appCredentials() {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) throw new Error("META_APP_ID / META_APP_SECRET が設定されていません");
  return { id, secret };
}

/** Graph API に GET リクエストを送り、返事（JSON）を受け取る */
async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const err = body.error ?? {};
    throw new GraphError(`Instagram APIエラー: ${err.message ?? res.statusText}`, err.code);
  }
  return body as T;
}

// ---------- ログイン（連携）の流れ ----------

/** Facebookのログイン画面のURLを作る */
export function buildLoginUrl(redirectUri: string, state: string) {
  const url = new URL(`https://www.facebook.com/${VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appCredentials().id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state); // なりすまし防止の合言葉
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

/** ログイン後に受け取ったコードを、長期（約60日）のユーザー用トークンに交換する */
export async function exchangeCodeForLongLivedToken(code: string, redirectUri: string) {
  const { id, secret } = appCredentials();
  // 1. コード → 短期トークン（約1〜2時間）
  const short = await graphGet<{ access_token: string }>("oauth/access_token", {
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    code,
  });
  // 2. 短期トークン → 長期トークン（約60日）
  const long = await graphGet<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: id,
    client_secret: secret,
    fb_exchange_token: short.access_token,
  });
  const expiresAt = long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null;
  return { userToken: long.access_token, expiresAt };
}

export type PageCandidate = {
  pageId: string;
  pageName: string;
  pageToken: string; // 長期ユーザートークンから取ったページ用トークン（期限なし）
  igUserId: string;
  igUsername: string;
};

/** ユーザーのFacebookページのうち、Instagramとつながっているものを一覧にする */
export async function listInstagramPages(userToken: string): Promise<PageCandidate[]> {
  const res = await graphGet<{
    data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[];
  }>("me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
    access_token: userToken,
  });
  return res.data
    .filter((p) => p.instagram_business_account)
    .map((p) => ({
      pageId: p.id,
      pageName: p.name,
      pageToken: p.access_token,
      igUserId: p.instagram_business_account!.id,
      igUsername: p.instagram_business_account!.username ?? "",
    }));
}

// ---------- 自分の投稿とインサイト（F-05） ----------

export type IgMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  permalink?: string;
  timestamp: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

/** 自分の最近の投稿を取得する（新しい順・最大50件） */
export async function fetchRecentMedia(igUserId: string, token: string) {
  const res = await graphGet<{ data: IgMedia[] }>(`${igUserId}/media`, {
    fields: "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count",
    limit: "50",
    access_token: token,
  });
  return res.data;
}

/** アプリで使う投稿種類（reel / carousel / image）に変換する */
export function toPostType(m: Pick<IgMedia, "media_type" | "media_product_type">) {
  if (m.media_product_type === "REELS" || m.media_type === "VIDEO") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "image";
}

export type MediaInsights = {
  reach: number | null;
  saved: number | null;
  shares: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

/** 投稿1件のインサイトを取得する */
export async function fetchMediaInsights(mediaId: string, token: string): Promise<MediaInsights> {
  const res = await graphGet<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
    `${mediaId}/insights`,
    { metric: "reach,saved,shares,views,likes,comments", access_token: token },
  );
  const get = (name: string) => {
    const m = res.data.find((d) => d.name === name);
    return m?.total_value?.value ?? m?.values?.[0]?.value ?? null;
  };
  return {
    reach: get("reach"),
    saved: get("saved"),
    shares: get("shares"),
    views: get("views"),
    likes: get("likes"),
    comments: get("comments"),
  };
}

// ---------- 競合アカウント（F-07） ----------

export type CompetitorData = {
  username: string;
  followers_count?: number;
  media_count?: number;
  media: { media_type: string; media_product_type?: string; like_count?: number; comments_count?: number; view_count?: number; timestamp: string; permalink?: string }[];
};

/** Business Discovery で競合アカウントの公開情報と最近の投稿を取得する */
export async function fetchCompetitor(myIgUserId: string, username: string, token: string): Promise<CompetitorData> {
  const mediaFields = "media_type,media_product_type,like_count,comments_count,timestamp,permalink";
  const request = (fields: string) =>
    graphGet<{ business_discovery: Omit<CompetitorData, "media"> & { media?: { data: CompetitorData["media"] } } }>(myIgUserId, {
      fields: `business_discovery.username(${username}){username,followers_count,media_count,media.limit(30){${fields}}}`,
      access_token: token,
    });

  // 再生数(view_count)は取れない場合があるので、失敗したら外してもう一度試す
  let res;
  try {
    res = await request(`${mediaFields},view_count`);
  } catch {
    res = await request(mediaFields);
  }
  const bd = res.business_discovery;
  return { username: bd.username ?? username, followers_count: bd.followers_count, media_count: bd.media_count, media: bd.media?.data ?? [] };
}
