-- Import legacy vacation periods to the RH monthly register and grant
-- Commercial users read-only access to those specific RH records.
-- Run after docs/supabase-business-cards.sql.
-- Legacy sales rows are retained unchanged; the monthly RH record is authoritative,
-- including an empty vacation list, so the existing manager-only trigger is preserved.

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

begin;

with legacy_months as (
  select distinct on (record.data ->> 'month')
    schedule.id,
    schedule.created_by,
    schedule.created_at,
    schedule.updated_at,
    schedule.data ->> 'month' as month,
    coalesce((
      select jsonb_agg(vacation.value order by vacation.value ->> 'employeeId')
      from jsonb_array_elements(
        case
          when jsonb_typeof(schedule.data -> 'vacations') = 'array' then schedule.data -> 'vacations'
          else '[]'::jsonb
        end
      ) as vacation(value)
      where nullif(trim(vacation.value ->> 'employeeId'), '') is not null
        and (vacation.value ->> 'startDate') ~ '^\d{4}-\d{2}-\d{2}$'
        and (vacation.value ->> 'endDate') ~ '^\d{4}-\d{2}-\d{2}$'
        and vacation.value ->> 'startDate' <= vacation.value ->> 'endDate'
        and left(vacation.value ->> 'startDate', 7) = schedule.data ->> 'month'
        and left(vacation.value ->> 'endDate', 7) = schedule.data ->> 'month'
    ), '[]'::jsonb) as vacations
  from public.business_card_records as schedule
  where schedule.module_key = 'sales-time-off'
    and schedule.sector = 'comercial'
    and schedule.data ->> 'month' ~ '^\d{4}-(0[1-9]|1[0-2])$'
  order by schedule.data ->> 'month', schedule.updated_at desc, schedule.id
)
insert into public.business_card_records (
  module_key, sector, title, status, data, created_by, created_at, updated_at
)
select
  'hr-leave-attendance',
  'rh',
  'Férias do mês - ' || legacy.month,
  'Registrado',
  jsonb_build_object(
    'recordType', 'monthly-vacations',
    'scheduleManagedVacations', true,
    'month', legacy.month,
    'vacations', legacy.vacations,
    'importedFromSalesTimeOffRecordId', legacy.id::text
  ),
  legacy.created_by,
  legacy.created_at,
  legacy.updated_at
from legacy_months as legacy
where not exists (
  select 1
  from public.business_card_records as existing
  where existing.module_key = 'hr-leave-attendance'
    and existing.sector = 'rh'
    and not existing.archived
    and existing.data ->> 'recordType' = 'monthly-vacations'
    and existing.data ->> 'scheduleManagedVacations' = 'true'
    and existing.data ->> 'month' = legacy.month
);

drop policy if exists business_card_hr_monthly_vacations_commercial_read
  on public.business_card_records;
create policy business_card_hr_monthly_vacations_commercial_read
  on public.business_card_records
  for select
  to authenticated
  using (
    sector = 'rh'
    and module_key = 'hr-leave-attendance'
    and not archived
    and data ->> 'recordType' = 'monthly-vacations'
    and data ->> 'scheduleManagedVacations' = 'true'
    and public.can_access_business_card('comercial')
  );

commit;
