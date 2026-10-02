-- =============================================================
-- Instagram運用AIアプリ 初期テーブル定義
-- Supabase管理画面の「SQL Editor」に貼り付けて実行してください。
-- 全テーブルに user_id を持たせ、RLS（行レベルセキュリティ）で
-- 「ログインしている本人のデータだけ」読み書きできるようにします。
-- =============================================================

-- ---------- ユーザー情報 ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  notify_email boolean not null default true,   -- メール通知を受け取るか
  created_at timestamptz not null default now()
);

-- 新規ユーザー登録時に profiles を自動作成する
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Instagramアカウントとアカウント方針 ----------
-- MVPは1ユーザー1アカウントだが、将来に備えて別テーブルにしている
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  genres text[] not null default '{}',        -- 選択ジャンル（複数）
  genre_other text,                            -- 「その他」の自由入力
  policy jsonb,                                -- AIヒアリングで決めたアカウント方針
  onboarded boolean not null default false,    -- 初回設定（S-02,S-03）が完了したか
  ig_user_id text,                             -- InstagramビジネスアカウントID（Day2）
  ig_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index accounts_user_id_key on public.accounts(user_id);

-- AIヒアリングのチャット履歴
create table public.hearing_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- 競合アカウント
create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  unique (account_id, username)
);

-- ---------- リサーチ・企画・生成物 ----------
create table public.research_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  content text not null,
  sources jsonb not null default '[]',         -- 参照したWebページ
  created_at timestamptz not null default now()
);

-- 企画（企画AIが3件ずつ提案）
-- status: proposed(提案中) / rejected(不採用) / adopted(採用・素材作成中)
--         / materials_ready(素材完成) / reported(完成報告済み)
--         / posted(投稿紐付け済み) / done(分析完了)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  batch_id uuid not null,                      -- 同時に提案された3件をまとめるID
  research_memo_id uuid references public.research_memos(id) on delete set null,
  title text not null,
  post_type text not null check (post_type in ('reel', 'carousel', 'image')),
  concept text not null,                       -- 企画の中身
  reason text,                                 -- なぜこの企画か
  recommendation text,                         -- 推奨投稿種類とその理由（3件共通）
  status text not null default 'proposed',
  adopted_at timestamptz,
  created_at timestamptz not null default now()
);

-- 採用企画の投稿素材（1企画につき1件）
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null unique references public.plans(id) on delete cascade,
  caption text,
  hashtags jsonb,        -- { large: [], medium: [], small: [] }
  bgm jsonb,             -- [{ name, artist, source: 'instagram'|'free', reason }]
  reel_structure jsonb,  -- [{ start, end, scene, shot, telop }]
  shot_list jsonb,       -- ["撮るべきカット", ...]
  telops jsonb,          -- ["テロップ文章", ...]
  updated_at timestamptz not null default now()
);

-- 完成報告（最終キャプション＋サムネ）と編集長AIの確認結果
create table public.completion_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  final_caption text not null,
  thumbnail_path text,                         -- Storage内のパス
  review jsonb,                                -- { ok, summary, checklist: [] }
  created_at timestamptz not null default now()
);

-- ---------- 投稿・インサイト ----------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  ig_media_id text,                            -- APIで取得した投稿ID（手入力時はnull）
  media_type text,                             -- reel / carousel / image
  permalink text,
  caption text,
  posted_at timestamptz,
  plan_id uuid references public.plans(id) on delete set null,
  link_status text not null default 'unlinked'
    check (link_status in ('unlinked', 'suggested', 'confirmed')),
  created_at timestamptz not null default now()
);
create unique index posts_ig_media_id_key on public.posts(account_id, ig_media_id);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  source text not null default 'manual' check (source in ('api', 'screenshot', 'manual')),
  likes int, comments int, reach int, saves int, shares int, plays int,
  captured_at timestamptz not null default now()
);

-- ---------- レポート・タスク・通知 ----------
-- kind: post_48h / post_7d / weekly / competitor
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null,
  post_id uuid references public.posts(id) on delete set null,
  analysis jsonb,                              -- 分析AIの出力
  summary jsonb,                               -- 編集長AIの改善案・次の提案
  created_at timestamptz not null default now()
);

-- 編集長AIから人間へのタスク
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  title text not null,
  detail text,
  link text,                                   -- タスクに対応する画面
  status text not null default 'todo' check (status in ('todo', 'done')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- RLS（本人のデータのみ） ----------
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'hearing_messages', 'competitors', 'research_memos', 'plans',
    'materials', 'completion_reports', 'posts', 'insights', 'reports',
    'tasks', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format('create index on public.%I (user_id)', t);
  end loop;
end $$;

-- ---------- サムネ画像の保存場所（Storage） ----------
-- 非公開バケット。パスは「ユーザーID/ファイル名」にして本人だけ読み書き可能
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', false);

create policy "own thumbnails" on storage.objects
  for all to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
