create table if not exists public.infrastructure_assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique,
  name text not null,
  category text not null,
  status text not null default 'Operacional'
    check (status in ('Operacional', 'Atenção', 'Indisponível', 'Em manutenção', 'Baixado')),
  sector text,
  location text,
  manufacturer text,
  model text,
  serial_number text,
  ip_address text,
  criticality text not null default 'Normal'
    check (criticality in ('Baixa', 'Normal', 'Alta', 'Crítica')),
  responsible text,
  acquired_on date,
  warranty_until date,
  last_maintenance_on date,
  next_maintenance_on date,
  preventive_interval_days integer check (preventive_interval_days is null or preventive_interval_days > 0),
  meter_reading bigint check (meter_reading is null or meter_reading >= 0),
  meter_threshold bigint check (meter_threshold is null or meter_threshold >= 0),
  meter_interval bigint check (meter_interval is null or meter_interval > 0),
  notes text,
  archived boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (warranty_until is null or acquired_on is null or warranty_until >= acquired_on)
);

alter table public.infrastructure_assets
  add column if not exists preventive_interval_days integer check (preventive_interval_days is null or preventive_interval_days > 0),
  add column if not exists meter_interval bigint check (meter_interval is null or meter_interval > 0);

create table if not exists public.infrastructure_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.infrastructure_assets(id) on delete restrict,
  maintenance_type text not null check (maintenance_type in ('Preventiva', 'Corretiva', 'Inspeção')),
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null check (length(trim(description)) between 1 and 5000),
  performed_on date not null,
  technician text not null check (length(trim(technician)) between 1 and 120),
  meter_reading bigint check (meter_reading is null or meter_reading >= 0),
  downtime_minutes integer check (downtime_minutes is null or downtime_minutes >= 0),
  cost numeric(12,2) check (cost is null or cost >= 0),
  next_maintenance_on date,
  ticket_reference text check (ticket_reference is null or length(ticket_reference) <= 120),
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  actor_name text not null default 'Usuário',
  created_at timestamptz not null default now()
);

create index if not exists infrastructure_assets_status_idx
  on public.infrastructure_assets (status, archived);
create index if not exists infrastructure_assets_next_maintenance_idx
  on public.infrastructure_assets (next_maintenance_on) where archived = false;
create index if not exists infrastructure_events_asset_performed_idx
  on public.infrastructure_maintenance_events (asset_id, performed_on desc, created_at desc);

do $$
begin
  if to_regclass('public.business_card_records') is not null then
    insert into public.infrastructure_assets (
  id, asset_tag, name, category, status, sector, location, manufacturer, model,
  serial_number, ip_address, criticality, responsible, last_maintenance_on,
  next_maintenance_on, notes, archived, created_by, created_at, updated_at
)
select
  r.id,
  coalesce(nullif(trim(r.data ->> 'assetTag'), ''), 'LEGACY-' || upper(substr(r.id::text, 1, 8))),
  r.title,
  coalesce(nullif(trim(r.data ->> 'category'), ''), 'Outro'),
  case lower(coalesce(r.status, ''))
    when 'atenção' then 'Atenção'
    when 'atencao' then 'Atenção'
    when 'indisponível' then 'Indisponível'
    when 'indisponivel' then 'Indisponível'
    when 'em manutenção' then 'Em manutenção'
    when 'em manutencao' then 'Em manutenção'
    when 'baixado' then 'Baixado'
    else 'Operacional'
  end,
  nullif(trim(r.data ->> 'sector'), ''),
  nullif(trim(r.data ->> 'location'), ''),
  nullif(trim(r.data ->> 'manufacturer'), ''),
  nullif(trim(r.data ->> 'model'), ''),
  nullif(trim(r.data ->> 'serialNumber'), ''),
  nullif(trim(r.data ->> 'ipAddress'), ''),
  coalesce(nullif(trim(r.data ->> 'criticality'), ''), 'Normal'),
  nullif(trim(r.data ->> 'owner'), ''),
  case when r.data ->> 'lastCheck' ~ '^\d{4}-\d{2}-\d{2}$' then (r.data ->> 'lastCheck')::date end,
  case when r.data ->> 'nextMaintenance' ~ '^\d{4}-\d{2}-\d{2}$' then (r.data ->> 'nextMaintenance')::date end,
  nullif(trim(concat_ws(E'\n', r.data ->> 'incidentNotes', r.data ->> 'notes')), ''),
  coalesce(r.archived, false),
  r.created_by,
  coalesce(r.created_at, now()),
  coalesce(r.updated_at, now())
from public.business_card_records r
where r.module_key = 'it-infrastructure'
  and nullif(trim(r.title), '') is not null
    on conflict (id) do nothing;
  end if;
end;
$$;

create or replace function public.infrastructure_can_manage_assets()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with identity as (
    select
      lower(coalesce(auth.jwt() ->> 'email', '')) as email,
      regexp_replace(lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'sector', '')), '[^a-z0-9]', '', 'g') as metadata_sector,
      lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) as metadata_role
  )
  select
    identity.email like 'adson.ri@%'
    or identity.metadata_sector = 'ti'
    or identity.metadata_sector like 'tecnologia%'
    or identity.metadata_sector like 'infra%'
    or identity.metadata_sector like 'ger%'
    or identity.metadata_sector like 'gest%'
    or identity.metadata_sector like 'dir%'
    or identity.metadata_role like '%adm%'
    or identity.metadata_role like '%gerente%'
    or identity.metadata_role like '%gestor%'
    or identity.metadata_role like '%diretor%'
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          lower(coalesce(p.nickname, '')) = 'adson.ri'
          or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') = 'ti'
          or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'tecnologia%'
          or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'infra%'
          or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'ger%'
          or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'gest%'
          or regexp_replace(lower(coalesce(p.sector, '')), '[^a-z0-9]', '', 'g') like 'dir%'
          or lower(coalesce(p.role, '')) like '%adm%'
          or lower(coalesce(p.role, '')) like '%gerente%'
          or lower(coalesce(p.role, '')) like '%gestor%'
          or lower(coalesce(p.role, '')) like '%diretor%'
        )
    )
  from identity;
$$;

create or replace function public.infrastructure_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists infrastructure_assets_updated_at on public.infrastructure_assets;
create trigger infrastructure_assets_updated_at
  before update on public.infrastructure_assets
  for each row execute function public.infrastructure_set_updated_at();

create or replace function public.infrastructure_set_event_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_id := auth.uid();
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.nickname), ''), 'Usuário')
    into new.actor_name
    from public.profiles p
   where p.id = auth.uid();
  new.actor_name := coalesce(new.actor_name, 'Usuário');
  return new;
end;
$$;

drop trigger if exists infrastructure_events_set_actor on public.infrastructure_maintenance_events;
create trigger infrastructure_events_set_actor
  before insert on public.infrastructure_maintenance_events
  for each row execute function public.infrastructure_set_event_actor();

alter table public.infrastructure_assets enable row level security;
alter table public.infrastructure_maintenance_events enable row level security;

drop policy if exists infrastructure_assets_read on public.infrastructure_assets;
drop policy if exists infrastructure_assets_read on public.infrastructure_assets;
create policy infrastructure_assets_read on public.infrastructure_assets
  for select to authenticated using (public.infrastructure_can_manage_assets());

drop policy if exists infrastructure_assets_add on public.infrastructure_assets;
create policy infrastructure_assets_add on public.infrastructure_assets
  for insert to authenticated with check (
    public.infrastructure_can_manage_assets() and created_by = auth.uid()
  );

drop policy if exists infrastructure_assets_edit on public.infrastructure_assets;
create policy infrastructure_assets_edit on public.infrastructure_assets
  for update to authenticated
  using (public.infrastructure_can_manage_assets())
  with check (public.infrastructure_can_manage_assets());

drop policy if exists infrastructure_assets_delete on public.infrastructure_assets;
drop policy if exists infrastructure_events_read on public.infrastructure_maintenance_events;
create policy infrastructure_events_read on public.infrastructure_maintenance_events
  for select to authenticated using (public.infrastructure_can_manage_assets());

drop policy if exists infrastructure_events_add on public.infrastructure_maintenance_events;

revoke all on public.infrastructure_assets, public.infrastructure_maintenance_events from anon;
revoke delete on public.infrastructure_assets from authenticated;
revoke insert, update, delete on public.infrastructure_maintenance_events from authenticated;
grant select, insert, update on public.infrastructure_assets to authenticated;
grant select on public.infrastructure_maintenance_events to authenticated;
revoke all on function public.infrastructure_can_manage_assets() from public;
grant execute on function public.infrastructure_can_manage_assets() to authenticated;

create or replace function public.register_infrastructure_maintenance(
  p_asset_id uuid,
  p_maintenance_type text,
  p_title text,
  p_description text,
  p_performed_on date,
  p_technician text,
  p_meter_reading bigint default null,
  p_downtime_minutes integer default null,
  p_cost numeric default null,
  p_next_maintenance_on date default null,
  p_ticket_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null or not public.infrastructure_can_manage_assets() then
    raise exception 'Acesso restrito ao setor de Tecnologia da Informação e administradores.';
  end if;
  if p_maintenance_type not in ('Preventiva', 'Corretiva', 'Inspeção') then
    raise exception 'Tipo de manutenção inválido.';
  end if;
  if nullif(trim(p_title), '') is null or length(trim(p_title)) > 180
    or nullif(trim(p_description), '') is null or length(trim(p_description)) > 5000
    or nullif(trim(p_technician), '') is null or length(trim(p_technician)) > 120 then
    raise exception 'Resumo, descrição e técnico são obrigatórios e devem respeitar os limites de tamanho.';
  end if;
  if p_meter_reading < 0 or p_downtime_minutes < 0 or p_cost < 0 then
    raise exception 'Medidor, tempo parado e custo não podem ser negativos.';
  end if;
  if not exists (
    select 1 from public.infrastructure_assets a
    where a.id = p_asset_id and a.archived = false
  ) then
    raise exception 'Equipamento não encontrado ou arquivado.';
  end if;

  insert into public.infrastructure_maintenance_events (
    asset_id, maintenance_type, title, description, performed_on, technician,
    meter_reading, downtime_minutes, cost, next_maintenance_on, ticket_reference, actor_id
  ) values (
    p_asset_id, p_maintenance_type, trim(p_title), trim(p_description), p_performed_on, trim(p_technician),
    p_meter_reading, p_downtime_minutes, p_cost, p_next_maintenance_on, nullif(trim(p_ticket_reference), ''), auth.uid()
  ) returning id into v_event_id;

  update public.infrastructure_assets
     set last_maintenance_on = p_performed_on,
         meter_reading = coalesce(p_meter_reading, meter_reading),
         next_maintenance_on = case
           when p_next_maintenance_on is not null then p_next_maintenance_on
           when p_maintenance_type = 'Preventiva' and preventive_interval_days is not null
             then p_performed_on + preventive_interval_days
           else next_maintenance_on
         end,
         meter_threshold = case
           when p_maintenance_type = 'Preventiva' and p_meter_reading is not null and meter_interval is not null
             then p_meter_reading + meter_interval
           else meter_threshold
         end,
         updated_at = now()
   where id = p_asset_id;

  return v_event_id;
end;
$$;

revoke all on function public.register_infrastructure_maintenance(uuid, text, text, text, date, text, bigint, integer, numeric, date, text) from public;
grant execute on function public.register_infrastructure_maintenance(uuid, text, text, text, date, text, bigint, integer, numeric, date, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'infrastructure_assets'
    ) then
      execute 'alter publication supabase_realtime add table public.infrastructure_assets';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'infrastructure_maintenance_events'
    ) then
      execute 'alter publication supabase_realtime add table public.infrastructure_maintenance_events';
    end if;
  end if;
end;
$$;
