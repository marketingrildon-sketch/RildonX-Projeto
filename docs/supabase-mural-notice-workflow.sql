-- Mural: audience targeting, publication workflow, scheduling, and acknowledgements.
-- Apply once in the Supabase SQL editor. This assumes public.posts and public.profiles
-- are the existing application tables and keeps legacy posts visible by default.
-- Mentioned profile IDs remain in post_metadata; notification preferences are stored per user/device in the browser.

alter table public.posts
  add column if not exists approval_status text not null default 'published',
  add column if not exists importance text not null default 'normal',
  add column if not exists pinned boolean not null default false,
  add column if not exists audience_sectors text[] not null default '{}',
  add column if not exists expires_at timestamptz,
  add column if not exists requires_acknowledgement boolean not null default false,
  add column if not exists scheduled_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_approval_status_check') then
    alter table public.posts
      add constraint posts_approval_status_check
      check (approval_status in ('draft', 'pending_approval', 'published', 'scheduled', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_importance_check') then
    alter table public.posts
      add constraint posts_importance_check
      check (importance in ('normal', 'important', 'urgent'));
  end if;
end
$$;

create index if not exists posts_mural_published_order_idx
  on public.posts (pinned desc, created_at desc)
  where approval_status in ('published', 'scheduled');
create index if not exists posts_mural_expiry_idx
  on public.posts (expires_at)
  where expires_at is not null;
create index if not exists posts_mural_audience_gin_idx
  on public.posts using gin (audience_sectors);

create or replace function public.mural_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(
    translate(lower(btrim(coalesce(p_value, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', '', 'g'
  );
$$;

create or replace function public.mural_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', 'false') = 'true'
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) in ('admin', 'administrator')
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          lower(coalesce(p.nickname, '')) = 'adson.ri'
          or public.mural_normalize_text(p.role) in ('admin', 'administrator', 'administrador')
        )
    );
$$;

create or replace function public.mural_is_sector_lead()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        public.mural_normalize_text(p.role) ~ '(gerente|gestor|diretor|administrador|coordenador|supervisor|lider)'
        or public.mural_normalize_text(p.sector) ~ '^(gerencia|gestao|diretoria)'
      )
  );
$$;

create or replace function public.mural_current_user_sector()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.mural_normalize_text(p.sector)
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.mural_can_manage_audience(p_audience_sectors text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.mural_is_admin()
    or (
      public.mural_is_sector_lead()
      and cardinality(coalesce(p_audience_sectors, '{}')) > 0
      and public.mural_current_user_sector() = any(coalesce(p_audience_sectors, '{}'))
    );
$$;

create or replace function public.mural_can_review_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.mural_is_admin()
    or exists (
      select 1
      from public.posts p
      where p.id = p_post_id
        and p.post_type in ('aviso', 'comunicado')
        and p.approval_status = 'pending_approval'
        and public.mural_can_manage_audience(p.audience_sectors)
    );
$$;

create or replace function public.mural_can_acknowledge_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.requires_acknowledgement
      and p.approval_status in ('published', 'scheduled')
      and (p.approval_status <> 'scheduled' or p.scheduled_at <= now())
      and (p.expires_at is null or p.expires_at > now())
      and (
        cardinality(p.audience_sectors) = 0
        or public.mural_current_user_sector() = any(p.audience_sectors)
      )
  );
$$;

create table if not exists public.post_acknowledgements (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'post_acknowledgements'
     ) then
    alter publication supabase_realtime add table public.post_acknowledgements;
  end if;
end
$$;

alter table public.post_acknowledgements enable row level security;
revoke all on public.post_acknowledgements from anon, authenticated;
grant select, insert on public.post_acknowledgements to authenticated;

drop policy if exists post_acknowledgements_read_scope on public.post_acknowledgements;
create policy post_acknowledgements_read_scope
  on public.post_acknowledgements
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.mural_is_admin()
    or exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

drop policy if exists post_acknowledgements_insert_own on public.post_acknowledgements;
create policy post_acknowledgements_insert_own
  on public.post_acknowledgements
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.mural_can_acknowledge_post(post_id)
  );

alter table public.posts enable row level security;

drop policy if exists mural_posts_visibility_restriction on public.posts;
create policy mural_posts_visibility_restriction
  on public.posts as restrictive
  for select to authenticated
  using (
    author_id = auth.uid()
    or public.mural_is_admin()
    or (
      post_type in ('aviso', 'comunicado')
      and approval_status = 'pending_approval'
      and public.mural_can_review_post(id)
    )
    or (
      approval_status in ('published', 'scheduled')
      and (approval_status <> 'scheduled' or scheduled_at <= now())
      and (expires_at is null or expires_at > now())
      and (
        cardinality(audience_sectors) = 0
        or public.mural_current_user_sector() = any(audience_sectors)
      )
    )
  );

create or replace function public.mural_can_interact_with_post(
  p_post_id uuid,
  p_required_type text default null
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (
        (p_required_type is null and p.post_type not in ('aviso', 'comunicado'))
        or p.post_type = p_required_type
      )
      and p.approval_status in ('published', 'scheduled')
      and (p.approval_status <> 'scheduled' or p.scheduled_at <= now())
      and (p.expires_at is null or p.expires_at > now())
  );
$$;

revoke all on function public.mural_can_interact_with_post(uuid, text) from public, anon;
grant execute on function public.mural_can_interact_with_post(uuid, text) to authenticated;

alter table public.post_comments enable row level security;
drop policy if exists mural_post_comments_scope on public.post_comments;
create policy mural_post_comments_scope
  on public.post_comments as restrictive
  for select to authenticated
  using (public.mural_can_interact_with_post(post_id));
drop policy if exists mural_post_comments_insert_scope on public.post_comments;
create policy mural_post_comments_insert_scope
  on public.post_comments as restrictive
  for insert to authenticated
  with check (public.mural_can_interact_with_post(post_id));

alter table public.post_reactions enable row level security;
drop policy if exists mural_post_reactions_scope on public.post_reactions;
create policy mural_post_reactions_scope
  on public.post_reactions as restrictive
  for select to authenticated
  using (public.mural_can_interact_with_post(post_id));
drop policy if exists mural_post_reactions_insert_scope on public.post_reactions;
create policy mural_post_reactions_insert_scope
  on public.post_reactions as restrictive
  for insert to authenticated
  with check (public.mural_can_interact_with_post(post_id));

alter table public.post_poll_votes enable row level security;
drop policy if exists mural_post_poll_votes_scope on public.post_poll_votes;
create policy mural_post_poll_votes_scope
  on public.post_poll_votes as restrictive
  for select to authenticated
  using (public.mural_can_interact_with_post(post_id, 'enquete'));
drop policy if exists mural_post_poll_votes_insert_scope on public.post_poll_votes;
create policy mural_post_poll_votes_insert_scope
  on public.post_poll_votes as restrictive
  for insert to authenticated
  with check (public.mural_can_interact_with_post(post_id, 'enquete'));
drop policy if exists mural_post_poll_votes_update_scope on public.post_poll_votes;
create policy mural_post_poll_votes_update_scope
  on public.post_poll_votes as restrictive
  for update to authenticated
  using (public.mural_can_interact_with_post(post_id, 'enquete'))
  with check (public.mural_can_interact_with_post(post_id, 'enquete'));

drop policy if exists mural_posts_insert_own on public.posts;
create policy mural_posts_insert_own
  on public.posts
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists mural_posts_insert_workflow_restriction on public.posts;
create policy mural_posts_insert_workflow_restriction
  on public.posts as restrictive
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (
        post_type in ('aviso', 'comunicado')
        and approval_status in ('draft', 'pending_approval', 'published', 'scheduled')
        and (
          approval_status in ('draft', 'pending_approval')
          or public.mural_can_manage_audience(audience_sectors)
        )
        and (
          public.mural_can_manage_audience(audience_sectors)
          or (
            not pinned
            and scheduled_at is null
            and (
              importance <> 'urgent'
              or approval_status in ('draft', 'pending_approval')
            )
          )
        )
      )
      or (
        post_type not in ('aviso', 'comunicado')
        and approval_status in ('draft', 'published')
        and cardinality(audience_sectors) = 0
        and importance = 'normal'
        and not pinned
        and expires_at is null
        and not requires_acknowledgement
        and scheduled_at is null
      )
    )
  );

drop policy if exists mural_posts_update_drafts_and_reviewers on public.posts;
create policy mural_posts_update_drafts_and_reviewers
  on public.posts
  for update to authenticated
  using (
    (author_id = auth.uid() and approval_status in ('draft', 'rejected'))
    or public.mural_can_review_post(id)
  )
  with check (
    (
      author_id = auth.uid()
      and (
        (
          post_type in ('aviso', 'comunicado')
          and approval_status in ('draft', 'pending_approval', 'rejected')
          and not pinned
          and scheduled_at is null
        )
        or (
          post_type not in ('aviso', 'comunicado')
          and approval_status in ('draft', 'published')
          and cardinality(audience_sectors) = 0
          and importance = 'normal'
          and not pinned
          and expires_at is null
          and not requires_acknowledgement
          and scheduled_at is null
        )
      )
    )
    or (
      post_type in ('aviso', 'comunicado')
      and approval_status in ('pending_approval', 'published', 'scheduled', 'rejected')
      and public.mural_can_manage_audience(audience_sectors)
    )
  );

drop policy if exists mural_posts_update_workflow_restriction on public.posts;
create policy mural_posts_update_workflow_restriction
  on public.posts as restrictive
  for update to authenticated
  using (
    (author_id = auth.uid() and approval_status in ('draft', 'rejected'))
    or public.mural_can_review_post(id)
  )
  with check (
    (
      author_id = auth.uid()
      and (
        (
          post_type in ('aviso', 'comunicado')
          and approval_status in ('draft', 'pending_approval', 'rejected')
          and not pinned
          and scheduled_at is null
        )
        or (
          post_type not in ('aviso', 'comunicado')
          and approval_status in ('draft', 'published')
          and cardinality(audience_sectors) = 0
          and importance = 'normal'
          and not pinned
          and expires_at is null
          and not requires_acknowledgement
          and scheduled_at is null
        )
      )
    )
    or (
      post_type in ('aviso', 'comunicado')
      and approval_status in ('pending_approval', 'published', 'scheduled', 'rejected')
      and public.mural_can_manage_audience(audience_sectors)
    )
  );

drop policy if exists mural_posts_delete_author_or_reviewer on public.posts;
create policy mural_posts_delete_author_or_reviewer
  on public.posts
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.mural_is_admin()
  );

create or replace function public.review_mural_post(
  p_post_id uuid,
  p_approved boolean,
  p_note text default null
)
returns public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reviewed_post public.posts;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.';
  end if;

  select * into reviewed_post
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Comunicado não encontrado.';
  end if;
  if reviewed_post.post_type not in ('aviso', 'comunicado')
     or reviewed_post.approval_status <> 'pending_approval' then
    raise exception 'Este item não está aguardando aprovação.';
  end if;
  if not public.mural_can_review_post(p_post_id) then
    raise exception 'Você não pode aprovar comunicados deste público.';
  end if;

  update public.posts
  set approval_status = case
        when not p_approved then 'rejected'
        when scheduled_at is not null and scheduled_at > now() then 'scheduled'
        else 'published'
      end,
      scheduled_at = case when p_approved then scheduled_at else null end,
      approved_by = case when p_approved then auth.uid() else null end,
      approved_at = case when p_approved then now() else null end,
      approval_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  where id = p_post_id
  returning * into reviewed_post;

  return reviewed_post;
end;
$$;

revoke all on function public.review_mural_post(uuid, boolean, text) from public, anon;
grant execute on function public.review_mural_post(uuid, boolean, text) to authenticated;

revoke all on function public.mural_normalize_text(text) from public, anon;
revoke all on function public.mural_is_admin() from public, anon;
revoke all on function public.mural_is_sector_lead() from public, anon;
revoke all on function public.mural_current_user_sector() from public, anon;
revoke all on function public.mural_can_manage_audience(text[]) from public, anon;
revoke all on function public.mural_can_review_post(uuid) from public, anon;
revoke all on function public.mural_can_acknowledge_post(uuid) from public, anon;
grant execute on function public.mural_normalize_text(text) to authenticated;
grant execute on function public.mural_is_admin() to authenticated;
grant execute on function public.mural_is_sector_lead() to authenticated;
grant execute on function public.mural_current_user_sector() to authenticated;
grant execute on function public.mural_can_manage_audience(text[]) to authenticated;
grant execute on function public.mural_can_review_post(uuid) to authenticated;
grant execute on function public.mural_can_acknowledge_post(uuid) to authenticated;
