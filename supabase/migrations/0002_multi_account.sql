-- =============================================================
-- 複数アカウント対応（例：グルメ用と旅行vlog用を1つのログインで切り替える）
-- 0001_init.sql を実行済みの状態で、SQL Editorに貼り付けて実行してください。
-- 今あるデータはそのまま残ります。
-- =============================================================

-- 1. 「1人につきアカウント1つ」のルールを外す
drop index if exists public.accounts_user_id_key;

-- 2. アカウントの呼び名（切り替えメニューに表示する名前。例：グルメ、旅行vlog）
alter table public.accounts add column if not exists name text;

-- 3. タスクと通知に「どのアカウントのものか」を追加する
alter table public.tasks
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.notifications
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

-- 4. すでにあるタスク・通知を、そのユーザーのアカウントに紐づける
--    （今は1人1アカウントなので、そのアカウントが入る）
update public.tasks t
set account_id = coalesce(
  (select p.account_id from public.plans p where p.id = t.plan_id),
  (select a.id from public.accounts a where a.user_id = t.user_id order by a.created_at limit 1)
)
where t.account_id is null;

update public.notifications n
set account_id = (select a.id from public.accounts a where a.user_id = n.user_id order by a.created_at limit 1)
where n.account_id is null;

-- 5. 今後は必ずアカウントを指定するようにする
--    （アカウントが無いユーザーの古いデータが万一残っていても失敗しないよう、該当行だけ消す）
delete from public.tasks where account_id is null;
delete from public.notifications where account_id is null;
alter table public.tasks alter column account_id set not null;
alter table public.notifications alter column account_id set not null;

-- 6. アカウントごとに絞り込んで表示するので、検索を速くする索引を作る
create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists tasks_account_id_idx on public.tasks (account_id);
create index if not exists notifications_account_id_idx on public.notifications (account_id);
create index if not exists plans_account_id_idx on public.plans (account_id);
create index if not exists posts_account_id_idx on public.posts (account_id);
create index if not exists reports_account_id_idx on public.reports (account_id);
