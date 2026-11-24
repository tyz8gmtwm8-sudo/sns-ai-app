// Google Maps の Places API（Text Search）で、店名からお店の情報を探す
// ※ サーバー側だけで使う（APIキーをブラウザに見せないため）
// 参考: https://developers.google.com/maps/documentation/places/web-service/text-search

export type StoreInfo = {
  id: string;
  name: string; // 店名
  address: string; // 住所
  hours: string[]; // 営業時間（曜日ごとに1行。例：「月曜日: 11時00分～20時00分」）
  phone: string | null; // 電話番号
  website: string | null; // 公式サイト
  instagram: string | null; // Instagramのユーザー名（公式サイト欄がInstagramのときだけ分かる）
  mapsUrl: string | null; // Googleマップのページ
};

// Places API から返ってくるデータのうち、使う部分だけの型
type PlaceResponse = {
  places?: {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    nationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
  }[];
  error?: { message: string };
};

// 取得する項目（Places APIは、欲しい項目を指定しないとエラーになる。項目によって料金が変わる）
const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.regularOpeningHours",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
].join(",");

// 「https://www.instagram.com/tokyo_cafe/」→「tokyo_cafe」
function instagramFromUrl(url: string | undefined) {
  const m = url?.match(/^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  return m ? m[2] : null;
}

/** 店名（＋地域名など）で検索して、候補を最大5件返す */
export async function searchStores(query: string): Promise<StoreInfo[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY が設定されていません（.env.local を確認してください）");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELDS,
    },
    // languageCode: 日本語で返してもらう / regionCode: 日本のお店を優先し、住所の「日本、」を省く
    body: JSON.stringify({ textQuery: query, languageCode: "ja", regionCode: "JP", pageSize: 5 }),
    cache: "no-store",
  });
  const data = (await res.json()) as PlaceResponse;
  if (!res.ok) throw new Error(`お店の検索に失敗しました: ${data.error?.message ?? res.status}`);

  return (data.places ?? []).map((p) => {
    const instagram = instagramFromUrl(p.websiteUri);
    return {
      id: p.id,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
      phone: p.nationalPhoneNumber ?? null,
      // 公式サイト欄がInstagramなら、Webサイトではなくインスタとして扱う
      website: instagram ? null : (p.websiteUri ?? null),
      instagram,
      mapsUrl: p.googleMapsUri ?? null,
    };
  });
}
