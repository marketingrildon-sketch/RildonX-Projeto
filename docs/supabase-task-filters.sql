-- Run in the Supabase SQL Editor to enable task metadata, saved preferences,
-- and the "Comentário atribuído" task filter.

alter table public.tasks
  add column if not exists task_metadata jsonb not null default '{}'::jsonb;

update public.tasks
set task_metadata = '{}'::jsonb
where task_metadata is null;

alter table public.tasks
  alter column task_metadata set default '{}'::jsonb,
  alter column task_metadata set not null;

create table if not exists public.task_user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  saved_filters jsonb not null default '[]'::jsonb,
  request_templates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.task_user_preferences enable row level security;

drop policy if exists "Users can read their task preferences" on public.task_user_preferences;
create policy "Users can read their task preferences"
  on public.task_user_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their task preferences" on public.task_user_preferences;
create policy "Users can insert their task preferences"
  on public.task_user_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their task preferences" on public.task_user_preferences;
create policy "Users can update their task preferences"
  on public.task_user_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.task_user_preferences to authenticated;

alter table public.task_comments
  add column if not exists assigned_to uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_comments_assigned_to_fkey'
      and conrelid = 'public.task_comments'::regclass
  ) then
    alter table public.task_comments
      add constraint task_comments_assigned_to_fkey
      foreign key (assigned_to) references auth.users (id) on delete set null;
  end if;
end
$$;

create index if not exists task_comments_assigned_to_idx
  on public.task_comments (assigned_to)
  where assigned_to is not null;

create or replace function public.rildonx_assign_task_comment(
  p_comment_id uuid,
  p_assigned_to uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'É necessário entrar para atribuir um comentário.';
  end if;

  if not exists (
    select 1
    from public.task_comments comment_row
    join public.tasks task_row on task_row.id = comment_row.task_id
    where comment_row.id = p_comment_id
      and (comment_row.author_id = actor_id or task_row.created_by = actor_id)
  ) then
    raise exception 'Somente o autor do comentário ou o criador da tarefa pode alterar a atribuição.';
  end if;

  update public.task_comments
  set assigned_to = p_assigned_to
  where id = p_comment_id;
end;
$$;

revoke all on function public.rildonx_assign_task_comment(uuid, uuid) from public;
grant execute on function public.rildonx_assign_task_comment(uuid, uuid) to authenticated;
