-- Calendar search, source links, private visibility and cross-device preferences.
-- Execute after supabase-calendar-sync.sql and the task/project migrations.

alter table public.events
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_record_id text,
  add column if not exists source_slot text,
  add column if not exists viewer_ids uuid[] not null default '{}',
  add column if not exists assignee_ids uuid[] not null default '{}';

alter table public.events
  drop constraint if exists events_visibility_check;
alter table public.events
  add constraint events_visibility_check
  check (visibility in ('team', 'private', 'restricted'));

alter table public.events
  drop constraint if exists events_source_type_check;
alter table public.events
  add constraint events_source_type_check
  check (source_type ~ '^[a-z][a-z0-9_-]{0,63}$');

create index if not exists events_source_record_idx
  on public.events(source_type, source_record_id, source_slot)
  where source_record_id is not null;
create index if not exists events_viewer_ids_idx
  on public.events using gin(viewer_ids)
  where visibility = 'restricted' and deleted_at is null;
create index if not exists events_assignee_ids_idx
  on public.events using gin(assignee_ids)
  where deleted_at is null;

drop policy if exists "events_read_authenticated" on public.events;
drop policy if exists "events_write_authenticated" on public.events;
drop policy if exists "events_read_visible" on public.events;
drop policy if exists "events_insert_visible" on public.events;
drop policy if exists "events_update_visible" on public.events;
drop policy if exists "events_delete_visible" on public.events;
drop policy if exists "events_read_members" on public.events;

create policy "events_read_visible" on public.events
  for select to authenticated
  using (
    auth.uid() is not null
    and (
      visibility = 'team'
      or (visibility = 'private' and owner_id = auth.uid())
      or (
        visibility = 'restricted'
        and (
          created_by = auth.uid()
          or auth.uid() = any(coalesce(viewer_ids, '{}'::uuid[]))
        )
      )
    )
  );

create policy "events_insert_visible" on public.events
  for insert to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and (
      (visibility = 'team' and owner_id is null)
      or (visibility = 'private' and owner_id = auth.uid())
      or (
        visibility = 'restricted'
        and owner_id is null
        and auth.uid() = any(coalesce(viewer_ids, '{}'::uuid[]))
      )
    )
  );

create policy "events_update_visible" on public.events
  for update to authenticated
  using (
    auth.uid() is not null
    and (
      visibility = 'team'
      or (visibility = 'private' and owner_id = auth.uid())
      or (
        visibility = 'restricted'
        and (
          created_by = auth.uid()
          or auth.uid() = any(coalesce(viewer_ids, '{}'::uuid[]))
        )
      )
    )
  )
  with check (
    auth.uid() is not null
    and (
      (visibility = 'team' and owner_id is null)
      or (visibility = 'private' and owner_id = auth.uid())
      or (
        visibility = 'restricted'
        and owner_id is null
        and (
          created_by = auth.uid()
          or auth.uid() = any(coalesce(viewer_ids, '{}'::uuid[]))
        )
      )
    )
  );

create policy "events_delete_visible" on public.events
  for delete to authenticated
  using (
    auth.uid() is not null
    and (
      visibility = 'team'
      or (visibility = 'private' and owner_id = auth.uid())
      or (
        visibility = 'restricted'
        and (
          created_by = auth.uid()
          or auth.uid() = any(coalesce(viewer_ids, '{}'::uuid[]))
        )
      )
    )
  );

create table if not exists public.calendar_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{"customCategories":[],"hiddenCategories":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint calendar_preferences_object_check
    check (jsonb_typeof(preferences) = 'object')
);

alter table public.calendar_preferences enable row level security;
drop policy if exists "calendar_preferences_read_own" on public.calendar_preferences;
drop policy if exists "calendar_preferences_insert_own" on public.calendar_preferences;
drop policy if exists "calendar_preferences_update_own" on public.calendar_preferences;

create policy "calendar_preferences_read_own" on public.calendar_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "calendar_preferences_insert_own" on public.calendar_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "calendar_preferences_update_own" on public.calendar_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.calendar_preferences to authenticated;

alter table public.calendar_event_links
  add column if not exists conflict_detected_at timestamptz;

drop policy if exists "calendar_event_links_read_own" on public.calendar_event_links;
create policy "calendar_event_links_read_own" on public.calendar_event_links
  for select to authenticated using (user_id = auth.uid());

alter table public.calendar_connections
  add column if not exists last_sync_error text;
