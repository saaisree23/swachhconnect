-- SwachhConnect v2: collection schedules, locations, persisted notifications, photo storage.
-- Run once in Supabase > SQL Editor, AFTER schema.sql.

create table wards(id int primary key, name text not null);
insert into wards values (3,'Ward 3'),(7,'Ward 7'),(9,'Ward 9'),(12,'Ward 12');

create table collection_schedules(
  id bigserial primary key,
  ward int not null references wards(id),
  weekday smallint not null check(weekday between 0 and 6),   -- 0 = Sunday (same as JS getDay)
  start_time time not null,
  end_time time not null,
  waste_type text not null default 'Mixed',
  vehicle text,
  active boolean not null default true);
create index on collection_schedules(ward, weekday);

create table saved_locations(
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  ward int references wards(id),
  created_at timestamptz not null default now());
create index on saved_locations(user_id);

create table notifications(
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  complaint_id text references complaints(id) on delete cascade,
  kind text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now());
create index on notifications(user_id, read, created_at desc);

-- Seed: Mon/Wed/Fri wet waste, Tue/Thu/Sat dry waste; start time staggered per ward. Edit freely.
insert into collection_schedules(ward,weekday,start_time,end_time,waste_type,vehicle)
select w.id, d, time '06:30' + (w.id % 3) * interval '30 minutes', time '07:30' + (w.id % 3) * interval '30 minutes',
  case when d in (1,3,5) then 'Wet (organic)' else 'Dry (plastic, paper, metal)' end,
  case w.id when 3 then 'V03' when 12 then 'V07' else null end
from wards w, generate_series(1,6) d;

-- Citizens get a notification row whenever their complaint is created or changes status.
create function notify_complaint() returns trigger language plpgsql security definer set search_path=public as $$
declare m text;
begin
  if new.citizen_id is null then return new; end if;
  if tg_op = 'INSERT' then
    m := 'Complaint ' || new.id || ' submitted.';
  elsif new.status is distinct from old.status then
    m := 'Complaint ' || new.id || ': ' || case new.status
      when 'ASSIGNED' then 'a vehicle has been assigned'
      when 'IN_PROGRESS' then 'collection is in progress'
      when 'RESOLVED' then 'resolved, the waste has been cleaned'
      when 'MISSED' then 'pickup missed, it will be rescheduled'
      else lower(new.status) end;
  else
    return new;
  end if;
  insert into notifications(user_id, complaint_id, kind, message) values (new.citizen_id, new.id, new.status, m);
  return new;
end $$;
create trigger complaints_notify after insert or update on complaints for each row execute function notify_complaint();

alter table wards enable row level security;
alter table collection_schedules enable row level security;
alter table saved_locations enable row level security;
alter table notifications enable row level security;

create policy wd_sel on wards for select to authenticated using (true);
create policy wd_all on wards for all using (my_role() = 'admin') with check (my_role() = 'admin');
create policy cs_sel on collection_schedules for select to authenticated using (true);
create policy cs_all on collection_schedules for all using (my_role() in ('operator','admin')) with check (my_role() in ('operator','admin'));
create policy sl_all on saved_locations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy nt_sel on notifications for select using (user_id = auth.uid());
create policy nt_upd on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Citizens may only flip the read flag; rows are created by the trigger above.
revoke update on notifications from authenticated;
grant update (read) on notifications to authenticated;

alter publication supabase_realtime add table notifications;

-- Photos: public-read bucket, each user can only upload into their own folder.
insert into storage.buckets(id, name, public) values ('complaint-images','complaint-images', true) on conflict do nothing;
create policy img_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'complaint-images' and (storage.foldername(name))[1] = auth.uid()::text);
