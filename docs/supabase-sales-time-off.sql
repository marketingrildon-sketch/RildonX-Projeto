-- Restrict writes to the shared Sales time-off schedule to managers.
-- Run after the business-card tables and public.can_access_business_card exist.

do $$
begin
  if to_regclass('public.business_card_records') is null then
    raise exception 'A tabela public.business_card_records não existe. Aplique primeiro a migração de cards setoriais.';
  end if;
  if to_regprocedure('public.can_access_business_card(text)') is null then
    raise exception 'A função public.can_access_business_card(text) não existe. Aplique primeiro a migração de cards setoriais.';
  end if;
end;
$$;

create or replace function public.guard_sales_time_off_manager()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_schedule boolean;
begin
  if tg_op = 'DELETE' then
    v_is_schedule := old.module_key = 'sales-time-off';
  elsif tg_op = 'UPDATE' then
    v_is_schedule := old.module_key = 'sales-time-off' or new.module_key = 'sales-time-off';
  else
    v_is_schedule := new.module_key = 'sales-time-off';
  end if;

  if v_is_schedule is distinct from true then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not public.can_access_business_card('gerencia') then
    raise exception 'Somente gestores podem alterar a Tabela de Folgas de Sábado.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_sales_time_off_manager() from public;

drop trigger if exists business_card_sales_time_off_manager_guard on public.business_card_records;
create trigger business_card_sales_time_off_manager_guard
  before insert or update or delete on public.business_card_records
  for each row
  execute function public.guard_sales_time_off_manager();
