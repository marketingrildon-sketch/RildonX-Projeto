create table if not exists public.internal_policy_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  version text not null check (length(trim(version)) between 1 and 40),
  effective_date date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  file_path text not null unique,
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists internal_policy_documents_status_updated_idx
  on public.internal_policy_documents (status, updated_at desc);

create unique index if not exists internal_policy_documents_title_version_idx
  on public.internal_policy_documents (lower(trim(title)), lower(trim(version)));

create unique index if not exists internal_policy_documents_one_published_title_idx
  on public.internal_policy_documents (lower(trim(title)))
  where status = 'published';

create or replace function public.internal_policy_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active is distinct from false
      and (
        lower(coalesce(p.nickname, '')) = 'adson.ri'
        or lower(coalesce(auth.jwt() ->> 'email', '')) like 'adson.ri@%'
        or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'gerencia%'
        or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'gestao%'
        or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'diretoria%'
        or regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]', '', 'g') ~ '(adm|gerente|gestor|diretor)'
        or (
          p.enabled_panels is not null
          and 'management-policies-library' = any(p.enabled_panels)
        )
      )
  );
$$;

revoke all on function public.internal_policy_can_manage() from public;
grant execute on function public.internal_policy_can_manage() to authenticated;

create or replace function public.internal_policy_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.file_path is distinct from old.file_path
      or new.file_name is distinct from old.file_name
      or new.mime_type is distinct from old.mime_type
      or new.file_size is distinct from old.file_size
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'O arquivo e a autoria de uma versão não podem ser alterados.';
    end if;
  end if;

  if new.status = 'published' then
    update public.internal_policy_documents
       set status = 'archived', updated_at = now()
     where lower(trim(title)) = lower(trim(new.title))
       and status = 'published'
       and id is distinct from new.id;
    new.published_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists internal_policy_documents_set_updated_at on public.internal_policy_documents;
create trigger internal_policy_documents_set_updated_at
  before insert or update on public.internal_policy_documents
  for each row execute function public.internal_policy_set_updated_at();

alter table public.internal_policy_documents enable row level security;

drop policy if exists internal_policy_documents_read on public.internal_policy_documents;
create policy internal_policy_documents_read on public.internal_policy_documents
  for select to authenticated
  using (status = 'published' or public.internal_policy_can_manage());

drop policy if exists internal_policy_documents_add on public.internal_policy_documents;
create policy internal_policy_documents_add on public.internal_policy_documents
  for insert to authenticated
  with check (
    public.internal_policy_can_manage()
    and created_by = auth.uid()
    and split_part(file_path, '/', 1) = auth.uid()::text
  );

drop policy if exists internal_policy_documents_edit on public.internal_policy_documents;
create policy internal_policy_documents_edit on public.internal_policy_documents
  for update to authenticated
  using (public.internal_policy_can_manage())
  with check (public.internal_policy_can_manage());

grant select, insert, update on public.internal_policy_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rildonx-internal-policies',
  'rildonx-internal-policies',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists internal_policy_files_read on storage.objects;
create policy internal_policy_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rildonx-internal-policies'
    and (
      public.internal_policy_can_manage()
      or exists (
        select 1
        from public.internal_policy_documents d
        where d.file_path = storage.objects.name
          and d.status = 'published'
      )
    )
  );

drop policy if exists internal_policy_files_add on storage.objects;
create policy internal_policy_files_add on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rildonx-internal-policies'
    and public.internal_policy_can_manage()
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists internal_policy_files_remove on storage.objects;
create policy internal_policy_files_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rildonx-internal-policies'
    and public.internal_policy_can_manage()
    and split_part(name, '/', 1) = auth.uid()::text
  );
