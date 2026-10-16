-- =============================================================
-- ネタ帳にAIの提案とアドバイスを入れる
-- 0001〜0004 を実行済みの状態で、SQL Editorに貼り付けて実行してください。
-- =============================================================

-- 分析の結果をもとにした、AIからのアドバイス（ネタごと）
alter table public.ideas add column if not exists advice text;
alter table public.ideas add column if not exists advice_at timestamptz;

-- ネタの状態に「AIからの提案（suggested）」を追加する
--   unused：未使用 / used：投稿に使った / suggested：AIが提案したネタ（まだネタ帳に追加していない）
alter table public.ideas drop constraint if exists ideas_status_check;
alter table public.ideas add constraint ideas_status_check check (status in ('unused', 'used', 'suggested'));
