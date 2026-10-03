-- SwachhConnect schema. Run once in Supabase > SQL Editor.
create table profiles(id uuid primary key references auth.users on delete cascade,name text,role text not null default 'citizen' check(role in('citizen','worker','operator','admin')),worker_key text);
create table workers(id text primary key,name text not null,vehicle text not null,duty boolean not null default false,mode text);
create table complaints(id text primary key,citizen_id uuid references auth.users,status text not null,priority text,ward int,assigned_worker text references workers(id),data jsonb not null default '{}',updated_at timestamptz not null default now());
create table activity(id bigserial primary key,msg text not null,created_at timestamptz not null default now());
create table vehicle_locations(id bigserial primary key,vehicle text,x real,y real,speed real,mode text,created_at timestamptz not null default now());
alter table complaints replica identity full;
create index on complaints(status);create index on complaints(assigned_worker);create index on complaints(citizen_id);

create function my_role() returns text language sql stable security definer set search_path=public as $$select role from profiles where id=auth.uid()$$;
create function my_worker() returns text language sql stable security definer set search_path=public as $$select worker_key from profiles where id=auth.uid()$$;
create function touch() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger complaints_touch before update on complaints for each row execute function touch();
create function new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,name) values(new.id,split_part(new.email,'@',1));return new;end$$;
create trigger on_auth_user after insert on auth.users for each row execute function new_user();

alter table profiles enable row level security;alter table workers enable row level security;alter table complaints enable row level security;alter table activity enable row level security;alter table vehicle_locations enable row level security;

create policy p_sel on profiles for select using(id=auth.uid() or my_role() in('operator','admin'));
create policy p_upd on profiles for update using(my_role()='admin');
create policy w_sel on workers for select using(my_role() in('worker','operator','admin'));
create policy w_upd on workers for update using(id=my_worker() or my_role()='admin');
create policy w_ins on workers for insert with check(my_role()='admin');
create policy w_del on workers for delete using(my_role()='admin');
create policy c_sel on complaints for select using(citizen_id=auth.uid() or my_role() in('operator','admin') or (my_role()='worker' and assigned_worker=my_worker()));
create policy c_ins on complaints for insert with check((citizen_id=auth.uid() and status='SUBMITTED') or my_role() in('operator','admin'));
create policy c_upd on complaints for update using(my_role() in('operator','admin') or (my_role()='worker' and assigned_worker=my_worker()))
  with check(my_role() in('operator','admin') or (my_role()='worker' and assigned_worker=my_worker() and status in('IN_PROGRESS','RESOLVED','MISSED')));
create policy a_ins on activity for insert with check(auth.uid() is not null);
create policy a_sel on activity for select using(my_role() in('operator','admin'));
create policy v_ins on vehicle_locations for insert with check(my_role() in('worker','admin'));
create policy v_sel on vehicle_locations for select using(my_role() in('operator','admin'));

-- Realtime: DB changes + private broadcast channel for live GPS
alter publication supabase_realtime add table complaints,workers,activity;
create policy loc_read on realtime.messages for select to authenticated using(my_role() in('operator','admin'));
create policy loc_write on realtime.messages for insert to authenticated with check(my_role() in('worker','operator','admin'));

insert into workers(id,name,vehicle) values('w1','Ravi','V07'),('w2','Anita','V03');
