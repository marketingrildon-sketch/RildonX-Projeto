-- Row-level access for the Commercial Management panel.
-- Apply after supabase-business-cards.sql and supabase-employee-control.sql.

begin;

insert into public.business_card_panel_catalog (panel_key)
values ('sales-commercial-management')
on conflict (panel_key) do nothing;

create or replace function public.can_manage_sales_commercial()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and (
        public.is_rildonx_admin()
        or lower(coalesce(p.nickname, '')) = 'adson.ri'
        or lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) = 'adson.ri'
        or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'gerencia%'
        or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'gestao%'
        or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'diretoria%'
        or regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]', '', 'g') ~ '(adm|gerente|gestor|diretor)'
      )
  );
$$;

revoke all on function public.can_manage_sales_commercial() from public, anon;
grant execute on function public.can_manage_sales_commercial() to authenticated;

create or replace function public.can_access_business_card_module(
  p_sector text,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and (
        public.is_rildonx_admin()
        or lower(coalesce(p.nickname, '')) = 'adson.ri'
        or lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) = 'adson.ri'
        or lower(coalesce(p.sector, '')) like 'ger%'
        or lower(coalesce(p.sector, '')) like 'gest%'
        or lower(coalesce(p.sector, '')) like 'diretoria%'
        or lower(coalesce(p.role, '')) like '%gest%'
        or regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]', '', 'g') ~ '(admin|gerente|gestor|diretor)'
        or (
          p.enabled_panels is not null
          and p_module_key = any(p.enabled_panels)
        )
        or (
          p_module_key = 'sales-commercial-management'
          and (
            regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'comercial%'
            or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like '%vendas%'
          )
        )
      )
  );
$$;

revoke all on function public.can_access_business_card_module(text, text) from public, anon;
grant execute on function public.can_access_business_card_module(text, text) to authenticated;

drop policy if exists business_card_sales_commercial_access_gate on public.business_card_records;
create policy business_card_sales_commercial_access_gate
  on public.business_card_records
  as restrictive
  for all
  to authenticated
  using (
    module_key <> 'sales-commercial-management'
    or public.can_manage_sales_commercial()
    or created_by = auth.uid()
    or (
      data ->> 'sellerId' = auth.uid()::text
    )
  )
  with check (
    module_key <> 'sales-commercial-management'
    or public.can_manage_sales_commercial()
    or (
      created_by = auth.uid()
      and data ->> 'recordType' <> 'goal'
      and data ->> 'sellerId' = auth.uid()::text
    )
  );

commit;
