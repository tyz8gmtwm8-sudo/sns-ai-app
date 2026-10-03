-- =============================================================
-- Instagram連携（F-04, F-05, F-07, F-15, F-16）
-- 0001, 0002 を実行済みの状態で、SQL Editorに貼り付けて実行してください。
-- =============================================================

-- ---------- Instagram連携情報（アプリのアカウントごとに1件） ----------
-- トークンはアプリ側で暗号化してから保存する（そのままでは読めない）
create table public.ig_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  page_id text not null,                       -- つながっているFacebookページ
  page_name text,
  ig_user_id text not null,                    -- InstagramプロアカウントのID
  ig_username text,
  page_token_enc text not null,                -- ページ用トークン（暗号化済み・期限なし）
  user_token_expires_at timestamptz,           -- 参考：ユーザー用トークンの期限
  status text not null default 'active' check (status in ('active', 'error')),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ig_user_id)                 -- 同じInstagramを2つのアカウントにつながない
);

-- ---------- 競合アカウントの取得データ（F-07） ----------
create table public.competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  username text not null,
  followers_count int,
  media_count int,
  media jsonb not null default '[]',           -- 最近の投稿（種類・いいね・コメント・日時）
  error text,                                  -- 取得できなかった理由
  fetched_at timestamptz not null default now()
);

-- ---------- 定期実行の記録（失敗をアプリ内に表示するため） ----------
create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  job text not null,                           -- daily など
  status text not null check (status in ('success', 'failed')),
  detail text,
  created_at timestamptz not null default now()
);

-- 投稿のサムネ画像URL（API取得時）
alter table public.posts add column if not exists thumbnail_url text;

-- ---------- RLS（本人のデータのみ） ----------
do $$
declare t text;
begin
  foreach t in array array['ig_connections', 'competitor_snapshots', 'job_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
    execute format('create index on public.%I (account_id)', t);
  end loop;
end $$;
