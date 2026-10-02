// 画面やAIで共通して使う定数

export const GENRES = [
  "グルメ",
  "美容",
  "ファッション",
  "vlog",
  "旅行",
  "フィットネス",
  "ビジネス",
  "勉強・資格",
  "その他",
] as const;

export const POST_TYPE_LABELS: Record<string, string> = {
  reel: "リール",
  carousel: "カルーセル",
  image: "画像",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  proposed: "提案中",
  rejected: "不採用",
  adopted: "素材作成中",
  materials_ready: "撮影・編集中",
  reported: "予約投稿待ち",
  posted: "公開済み",
  done: "分析完了",
};

export const REPORT_KIND_LABELS: Record<string, string> = {
  post_48h: "48時間後レポート",
  post_7d: "7日後レポート",
  weekly: "週次レポート",
  competitor: "競合分析",
};
