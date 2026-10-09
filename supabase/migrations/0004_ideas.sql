-- =============================================================
-- ネタ帳（AIの精度改善）
-- 0001〜0003 を実行済みの状態で、SQL Editorに貼り付けて実行してください。
-- =============================================================

-- 行ったお店・撮った素材・感想などの「事実」をメモしておく場所
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,                         -- 例：〇〇カフェ、秋のニットコーデ
  memo text not null default '',               -- 事実と感想（メニュー・価格・場所・良かった点など）
  photo_paths text[] not null default '{}',    -- 撮った写真（Storage内のパス。最大3枚）
  status text not null default 'unused' check (status in ('unused', 'used')),
  created_at timestamptz not null default now()
);

alter table public.ideas enable row level security;
create policy "own rows" on public.ideas
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index on public.ideas (account_id);

-- 企画がどのネタから作られたか
alter table public.plans add column if not exists idea_ids uuid[] not null default '{}';
