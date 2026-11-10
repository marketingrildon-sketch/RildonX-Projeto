-- Apply after supabase-collaboration-access-and-profile-self-service.sql.
-- Storage reads are authorized against canonical object paths, never user-editable URLs.
-- Login attempt state is private and can only be changed through service-role RPCs.

begin;

alter table public.documents
  add column if not exists storage_path text;

update public.documents document
set storage_path = (regexp_match(
  document.url,
  '/storage/v1/object/(sign|authenticated|public)/rildonx-files/([^?]+)'
))[2]
where document.storage_path is null
  and document.owner_id is not null
  and document.url is not null
  and split_part(
    (regexp_match(
      document.url,
      '/storage/v1/object/(sign|authenticated|public)/rildonx-files/([^?]+)'
    ))[2],
    '/',
    1
  ) = document.owner_id::text;

alter table public.documents
  drop constraint if exists documents_storage_path_owner_check;
alter table public.documents
  add constraint documents_storage_path_owner_check
  check (
    storage_path is null
    or (
      owner_id is not null
      and split_part(storage_path, '/', 1) = owner_id::text
      and storage_path not like '/%'
      and position('..' in storage_path) = 0
      and position('?' in storage_path) = 0
      and position('#' in storage_path) = 0
    )
  ) not valid;
alter table public.documents
  validate constraint documents_storage_path_owner_check;

create or replace function public.rildonx_can_access_file(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    public.is_rildonx_admin()
    or split_part(p_object_name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.profiles profile
      where profile.active
        and split_part(
          (regexp_match(
            coalesce(profile.avatar_url, ''),
            '/storage/v1/object/(sign|authenticated|public)/rildonx-files/([^?]+)'
          ))[2],
          '/',
          1
        ) = profile.id::text
        and (regexp_match(
          coalesce(profile.avatar_url, ''),
          '/storage/v1/object/(sign|authenticated|public)/rildonx-files/([^?]+)'
        ))[2] = p_object_name
    )
    or exists (
      select 1
      from public.documents document
      where document.storage_path = p_object_name
        and split_part(document.storage_path, '/', 1) = document.owner_id::text
        and public.rildonx_can_access_document(document.id)
    )
  );
$$;

revoke all on function public.rildonx_can_access_file(text) from public, anon;
grant execute on function public.rildonx_can_access_file(text) to authenticated;

drop policy if exists "rildonx_files_read_authenticated" on storage.objects;
drop policy if exists "rildonx_files_read_owner_or_viewer" on storage.objects;
drop policy if exists "rildonx_files_read_collaborators" on storage.objects;
create policy "rildonx_files_read_collaborators" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rildonx-files'
    and public.rildonx_can_access_file(name)
  );

create schema if not exists private;

create table if not exists private.rildonx_login_attempts (
  identifier_hash text primary key check (identifier_hash ~ '^[a-f0-9]{64}$'),
  failure_count integer not null check (failure_count between 0 and 5),
  window_started_at timestamptz not null,
  locked_until timestamptz,
  alert_claimed_at timestamptz,
  alert_sent_at timestamptz
);
alter table private.rildonx_login_attempts enable row level security;
revoke all on private.rildonx_login_attempts from public, anon, authenticated, service_role;

create or replace function public.rildonx_check_login_lock(p_identifier_hash text)
returns table (locked_until timestamptz, locked boolean)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if p_identifier_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid login identifier hash.';
  end if;

  return query
  select attempts.locked_until, coalesce(attempts.locked_until > now(), false)
  from private.rildonx_login_attempts attempts
  where attempts.identifier_hash = p_identifier_hash;

  if not found then
    return query select null::timestamptz, false;
  end if;
end;
$$;

create or replace function public.rildonx_record_login_failure(p_identifier_hash text)
returns table (failure_count integer, locked_until timestamptz, locked boolean)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  attempt private.rildonx_login_attempts%rowtype;
  v_now timestamptz := now();
begin
  if p_identifier_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid login identifier hash.';
  end if;

  insert into private.rildonx_login_attempts (
    identifier_hash, failure_count, window_started_at
  ) values (p_identifier_hash, 0, v_now)
  on conflict (identifier_hash) do nothing;

  select * into attempt
  from private.rildonx_login_attempts
  where identifier_hash = p_identifier_hash
  for update;

  if attempt.locked_until > v_now then
    return query select attempt.failure_count, attempt.locked_until, true;
    return;
  end if;

  if attempt.window_started_at <= v_now - interval '15 minutes'
     or attempt.locked_until is not null then
    update private.rildonx_login_attempts
    set failure_count = 1,
        window_started_at = v_now,
        locked_until = null,
        alert_claimed_at = null,
        alert_sent_at = null
    where identifier_hash = p_identifier_hash
    returning * into attempt;
  else
    update private.rildonx_login_attempts as existing
    set failure_count = least(existing.failure_count + 1, 5),
        locked_until = case
          when existing.failure_count + 1 >= 5 then v_now + interval '15 minutes'
          else null
        end,
        alert_claimed_at = case
          when existing.failure_count + 1 >= 5 then null
          else existing.alert_claimed_at
        end,
        alert_sent_at = case
          when existing.failure_count + 1 >= 5 then null
          else existing.alert_sent_at
        end
    where existing.identifier_hash = p_identifier_hash
    returning * into attempt;
  end if;

  return query
  select attempt.failure_count, attempt.locked_until, coalesce(attempt.locked_until > v_now, false);
end;
$$;

create or replace function public.rildonx_claim_login_alert(p_identifier_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  claimed boolean;
begin
  if p_identifier_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid login identifier hash.';
  end if;

  update private.rildonx_login_attempts
  set alert_claimed_at = now()
  where identifier_hash = p_identifier_hash
    and locked_until > now()
    and alert_sent_at is null
    and (alert_claimed_at is null or alert_claimed_at < now() - interval '2 minutes')
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

create or replace function public.rildonx_mark_login_alert_sent(
  p_identifier_hash text,
  p_sent boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if p_identifier_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid login identifier hash.';
  end if;

  update private.rildonx_login_attempts
  set alert_sent_at = case when p_sent then now() else null end,
      alert_claimed_at = null
  where identifier_hash = p_identifier_hash;
end;
$$;

create or replace function public.rildonx_reset_login_attempts(p_identifier_hash text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if p_identifier_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid login identifier hash.';
  end if;

  delete from private.rildonx_login_attempts
  where identifier_hash = p_identifier_hash;
end;
$$;

revoke all on function public.rildonx_check_login_lock(text) from public, anon, authenticated;
revoke all on function public.rildonx_record_login_failure(text) from public, anon, authenticated;
revoke all on function public.rildonx_claim_login_alert(text) from public, anon, authenticated;
revoke all on function public.rildonx_mark_login_alert_sent(text, boolean) from public, anon, authenticated;
revoke all on function public.rildonx_reset_login_attempts(text) from public, anon, authenticated;
grant execute on function public.rildonx_check_login_lock(text) to service_role;
grant execute on function public.rildonx_record_login_failure(text) to service_role;
grant execute on function public.rildonx_claim_login_alert(text) to service_role;
grant execute on function public.rildonx_mark_login_alert_sent(text, boolean) to service_role;
grant execute on function public.rildonx_reset_login_attempts(text) to service_role;

notify pgrst, 'reload schema';

commit;
