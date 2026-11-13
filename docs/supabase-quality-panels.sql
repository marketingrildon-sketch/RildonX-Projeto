-- Access rules for the Quality panels in business_card_records.
-- Existing policies for other sectors remain in effect.

do $$
begin
  if to_regclass('public.business_card_records') is null then
    raise exception 'A tabela public.business_card_records não existe. Aplique primeiro a migração dos cards setoriais.';
  end if;
end;
$$;

alter table public.business_card_records enable row level security;

create or replace function public.quality_can_access_panels()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with session_claims as (
    select
      lower(coalesce(auth.jwt() ->> 'email', '')) as email,
      regexp_replace(lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'sector', '')), '[^a-z0-9]', '', 'g') as metadata_sector,
      regexp_replace(lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')), '[^a-z0-9]', '', 'g') as metadata_role
  )
  select auth.uid() is not null and (
      session_claims.email like 'adson.ri@%'
      or session_claims.metadata_sector like 'qualidade%'
      or session_claims.metadata_sector = 'quality'
      or session_claims.metadata_sector like 'sgq%'
      or session_claims.metadata_role like '%adm%'
      or session_claims.metadata_role like '%gerente%'
      or session_claims.metadata_role like '%gestor%'
      or session_claims.metadata_role like '%diretor%'
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and (
            lower(coalesce(p.nickname, '')) = 'adson.ri'
            or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'qualidade%'
            or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') = 'quality'
            or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'sgq%'
            or regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]', '', 'g') like '%adm%'
            or regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]', '', 'g') like '%gerente%'
            or regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]', '', 'g') like '%gestor%'
            or regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]', '', 'g') like '%diretor%'
          )
      )
    )
  from session_claims;
$$;

revoke all on function public.quality_can_access_panels() from public;
revoke all on function public.quality_can_access_panels() from anon;
grant execute on function public.quality_can_access_panels() to authenticated;

-- A restrictive policy gates Quality rows even if another permissive policy is broad.
-- Rows belonging to other sectors continue to follow their existing policies.
drop policy if exists business_card_quality_access_gate on public.business_card_records;
create policy business_card_quality_access_gate
  on public.business_card_records
  as restrictive
  for all
  to authenticated
  using (
    (
      regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') not like 'qualidade%'
      and regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') <> 'quality'
      and regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') not like 'sgq%'
    )
    or public.quality_can_access_panels()
  )
  with check (
    (
      regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') not like 'qualidade%'
      and regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') <> 'quality'
      and regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') not like 'sgq%'
    )
    or public.quality_can_access_panels()
  );

-- This permissive policy grants authorized Quality users access to their sector's rows.
drop policy if exists business_card_quality_access on public.business_card_records;
create policy business_card_quality_access
  on public.business_card_records
  as permissive
  for all
  to authenticated
  using (
    regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') like 'qualidade%'
    or regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') = 'quality'
    or regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') like 'sgq%'
  )
  with check (
    (
      regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') like 'qualidade%'
      or regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') = 'quality'
      or regexp_replace(lower(coalesce(sector, '')), '[^a-z0-9]', '', 'g') like 'sgq%'
    )
    and public.quality_can_access_panels()
  );
