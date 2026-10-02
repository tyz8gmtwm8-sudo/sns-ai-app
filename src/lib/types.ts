// DBのテーブルに対応する型（よく使うものだけ）

export type Policy = {
  target: string; // ターゲット
  region: string; // 地域
  purpose: string; // アカウントの目的
  worldview: string; // 世界観・トーン
  followers: number | null; // 現在のフォロワー数
  post_frequency: string; // 投稿頻度
  competitors: string[]; // 競合アカウント（@なしのユーザー名）
  notes: string; // その他メモ
};

export type Account = {
  id: string;
  user_id: string;
  genres: string[];
  genre_other: string | null;
  policy: Policy | null;
  onboarded: boolean;
  ig_user_id: string | null;
  ig_username: string | null;
};

export type Plan = {
  id: string;
  batch_id: string;
  title: string;
  post_type: "reel" | "carousel" | "image";
  concept: string;
  reason: string | null;
  status: string;
  created_at: string;
  adopted_at: string | null;
};

export type Hashtags = { large: string[]; medium: string[]; small: string[] };
export type Bgm = { name: string; artist: string; source: "instagram" | "free"; reason: string };
export type Cut = { start: number; end: number; scene: string; shot: string; telop: string };

export type Materials = {
  id: string;
  plan_id: string;
  caption: string | null;
  hashtags: Hashtags | null;
  bgm: Bgm[] | null;
  reel_structure: Cut[] | null;
  shot_list: string[] | null;
  telops: string[] | null;
};

export type Review = { ok: boolean; summary: string; checklist: string[] };

export type Task = {
  id: string;
  plan_id: string | null;
  title: string;
  detail: string | null;
  link: string | null;
  status: "todo" | "done";
};

export type Analysis = {
  headline: string;
  good_points: string[];
  issues: string[];
  metrics_comment: string;
};

export type ChiefSummary = {
  improvements: string[];
  next_suggestions: string[];
  message: string;
};
