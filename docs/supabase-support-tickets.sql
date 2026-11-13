create table if not exists public.support_ticket_sequences (
  ticket_year integer not null,
  ticket_month integer not null,
  last_number integer not null default 0,
  primary key (ticket_year, ticket_month)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  requester_name text not null,
  requester_sector text not null default '',
  unit text not null default '',
  equipment text not null default '',
  rustdesk_id text not null default '',
  category text not null,
  priority text not null default 'Normal'
    check (priority in ('Baixa', 'Normal', 'Alta', 'Urgente')),
  description text not null,
  status text not null default 'Aberto'
    check (status in ('Aberto', 'Em atendimento', 'Aguardando usuário', 'Resolvido', 'Encerrado')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_name text not null,
  event_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create or replace function public.support_set_history_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
    select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.nickname), ''), 'Usuário')
      into new.actor_name
      from public.profiles p
     where p.id = auth.uid();
    new.actor_name := coalesce(new.actor_name, 'Usuário');
  end if;
  return new;
end;
$$;

drop trigger if exists support_ticket_history_actor on public.support_ticket_history;
create trigger support_ticket_history_actor
  before insert on public.support_ticket_history
  for each row execute function public.support_set_history_actor();

create index if not exists support_tickets_created_by_created_at_idx
  on public.support_tickets (created_by, created_at desc);
create index if not exists support_tickets_status_created_at_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_ticket_history_ticket_created_at_idx
  on public.support_ticket_history (ticket_id, created_at);

create or replace function public.support_can_manage_tickets()
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

alter table public.support_tickets enable row level security;
alter table public.support_ticket_history enable row level security;
alter table public.support_ticket_sequences enable row level security;

drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets
  for select to authenticated
  using (created_by = auth.uid() or public.support_can_manage_tickets());

drop policy if exists support_tickets_manage on public.support_tickets;
create policy support_tickets_manage on public.support_tickets
  for update to authenticated
  using (public.support_can_manage_tickets())
  with check (public.support_can_manage_tickets());

drop policy if exists support_ticket_history_read on public.support_ticket_history;
create policy support_ticket_history_read on public.support_ticket_history
  for select to authenticated
  using (
    public.support_can_manage_tickets()
    or exists (
      select 1
      from public.support_tickets t
      where t.id = ticket_id and t.created_by = auth.uid()
    )
  );

drop policy if exists support_ticket_history_add on public.support_ticket_history;
create policy support_ticket_history_add on public.support_ticket_history
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (
      (
        public.support_can_manage_tickets()
        and event_type in ('observação', 'acesso remoto')
      )
      or (
        not public.support_can_manage_tickets()
        and event_type = 'resposta do solicitante'
        and exists (
          select 1
          from public.support_tickets t
          where t.id = ticket_id and t.created_by = auth.uid()
        )
      )
    )
  );

revoke all on public.support_ticket_sequences from anon, authenticated;
grant select on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_history to authenticated;
revoke all on function public.support_can_manage_tickets() from public;
grant execute on function public.support_can_manage_tickets() to authenticated;

create or replace function public.create_support_ticket(
  p_unit text,
  p_equipment text,
  p_rustdesk_id text,
  p_category text,
  p_priority text,
  p_description text
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_name text;
  current_user_sector text;
  v_ticket_year integer := extract(year from now())::integer;
  v_ticket_month integer := extract(month from now())::integer;
  ticket_sequence integer;
  new_ticket public.support_tickets;
begin
  if current_user_id is null then
    raise exception 'Entre novamente para abrir um chamado.';
  end if;
  if length(trim(coalesce(p_description, ''))) < 5 then
    raise exception 'Descreva o problema com pelo menos 5 caracteres.';
  end if;
  if trim(coalesce(p_category, '')) = '' then
    raise exception 'Selecione uma categoria.';
  end if;
  if p_priority not in ('Baixa', 'Normal', 'Alta', 'Urgente') then
    raise exception 'A prioridade informada não é válida.';
  end if;
  if coalesce(trim(p_rustdesk_id), '') !~ '^[0-9]{6,20}$' then
    raise exception 'O ID RustDesk deve conter de 6 a 20 números.';
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.nickname), ''), 'Usuário'),
         coalesce(p.sector, '')
    into current_user_name, current_user_sector
    from public.profiles p
   where p.id = current_user_id;
  current_user_name := coalesce(current_user_name, 'Usuário');
  current_user_sector := coalesce(current_user_sector, '');

  insert into public.support_ticket_sequences as sequence_row (ticket_year, ticket_month, last_number)
  values (v_ticket_year, v_ticket_month, 1)
  on conflict (ticket_year, ticket_month)
  do update set last_number = sequence_row.last_number + 1
  returning sequence_row.last_number into ticket_sequence;

  insert into public.support_tickets (
    ticket_number, created_by, requester_name, requester_sector, unit, equipment,
    rustdesk_id, category, priority, description
  )
  values (
    format('CH-%s-%s-%s', v_ticket_year, lpad(v_ticket_month::text, 2, '0'), lpad(ticket_sequence::text, 4, '0')),
    current_user_id, current_user_name, current_user_sector, trim(coalesce(p_unit, '')),
    trim(coalesce(p_equipment, '')), trim(coalesce(p_rustdesk_id, '')), trim(p_category),
    p_priority, trim(p_description)
  )
  returning * into new_ticket;

  insert into public.support_ticket_history (ticket_id, actor_id, actor_name, event_type, description)
  values (new_ticket.id, current_user_id, current_user_name, 'created', 'Chamado aberto.');
  return new_ticket;
end;
$$;

create or replace function public.update_support_ticket(
  p_ticket_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assigned_to uuid default null,
  p_comment text default null
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_name text;
  old_ticket public.support_tickets;
  new_ticket public.support_tickets;
begin
  if current_user_id is null or not public.support_can_manage_tickets() then
    raise exception 'Apenas a equipe de TI pode atualizar chamados.';
  end if;
  if p_status is not null and p_status not in ('Aberto', 'Em atendimento', 'Aguardando usuário', 'Resolvido', 'Encerrado') then
    raise exception 'O status informado não é válido.';
  end if;
  if p_priority is not null and p_priority not in ('Baixa', 'Normal', 'Alta', 'Urgente') then
    raise exception 'A prioridade informada não é válida.';
  end if;
  if p_assigned_to is not null and not exists (
    select 1
    from public.profiles p
    where p.id = p_assigned_to
      and (
        lower(coalesce(p.sector, '')) = 'ti'
        or lower(coalesce(p.sector, '')) like 'tecnologia%'
        or lower(coalesce(p.sector, '')) like 'infra%'
        or lower(coalesce(p.sector, '')) like 'ger%'
        or lower(coalesce(p.sector, '')) like 'gest%'
        or lower(coalesce(p.sector, '')) like 'dir%'
        or lower(coalesce(p.nickname, '')) = 'adson.ri'
        or lower(coalesce(p.role, '')) like '%adm%'
        or lower(coalesce(p.role, '')) like '%gerente%'
        or lower(coalesce(p.role, '')) like '%gestor%'
        or lower(coalesce(p.role, '')) like '%diretor%'
      )
  ) then
    raise exception 'O responsável selecionado não pertence à equipe autorizada.';
  end if;

  select * into old_ticket
    from public.support_tickets
   where id = p_ticket_id
   for update;
  if not found then
    raise exception 'O chamado não foi encontrado.';
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.nickname), ''), 'Equipe de TI')
    into current_user_name
    from public.profiles p
   where p.id = current_user_id;
  current_user_name := coalesce(current_user_name, 'Equipe de TI');

  update public.support_tickets
     set status = coalesce(p_status, status),
         priority = coalesce(p_priority, priority),
         assigned_to = p_assigned_to,
         updated_at = now()
   where id = p_ticket_id
   returning * into new_ticket;

  if new_ticket.status is distinct from old_ticket.status then
    insert into public.support_ticket_history (ticket_id, actor_id, actor_name, event_type, description)
    values (p_ticket_id, current_user_id, current_user_name, 'status', 'Status alterado de ' || old_ticket.status || ' para ' || new_ticket.status || '.');
  end if;
  if new_ticket.priority is distinct from old_ticket.priority then
    insert into public.support_ticket_history (ticket_id, actor_id, actor_name, event_type, description)
    values (p_ticket_id, current_user_id, current_user_name, 'priority', 'Prioridade alterada de ' || old_ticket.priority || ' para ' || new_ticket.priority || '.');
  end if;
  if new_ticket.assigned_to is distinct from old_ticket.assigned_to then
    insert into public.support_ticket_history (ticket_id, actor_id, actor_name, event_type, description)
    values (p_ticket_id, current_user_id, current_user_name, 'assignment', 'Chamado atribuído à equipe de TI.');
  end if;
  if nullif(trim(coalesce(p_comment, '')), '') is not null then
    insert into public.support_ticket_history (ticket_id, actor_id, actor_name, event_type, description)
    values (p_ticket_id, current_user_id, current_user_name, 'comment', trim(p_comment));
  end if;
  return new_ticket;
end;
$$;

revoke all on function public.create_support_ticket(text, text, text, text, text, text) from public;
grant execute on function public.create_support_ticket(text, text, text, text, text, text) to authenticated;
revoke all on function public.update_support_ticket(uuid, text, text, uuid, text) from public;
grant execute on function public.update_support_ticket(uuid, text, text, uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_ticket_history'
  ) then
    alter publication supabase_realtime add table public.support_ticket_history;
  end if;
end;
$$;
