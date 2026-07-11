-- Outmates participation + notifications foundation.
-- Run in Supabase SQL editor after adapting policies to your auth rules.

alter table public.activities
  add column if not exists organizer_id uuid references auth.users(id),
  add column if not exists closed_at timestamptz;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists pseudo text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists participants_activity_id_idx
  on public.participants(activity_id);

create index if not exists participants_user_id_idx
  on public.participants(user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_at_idx
  on public.notifications(user_id, created_at desc);

create table if not exists public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_messages_activity_created_at_idx
  on public.activity_messages(activity_id, created_at asc);

alter table public.participants enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_messages enable row level security;
alter table public.profiles enable row level security;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can create their profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Participants can read their own rows"
  on public.participants for select
  using (auth.uid() = user_id);

create policy "Organizers can read requests for their activities"
  on public.participants for select
  using (
    exists (
      select 1
      from public.activities
      where activities.id = participants.activity_id
        and activities.organizer_id = auth.uid()
    )
  );

create policy "Users can request participation"
  on public.participants for insert
  with check (auth.uid() = user_id);

create policy "Organizers can answer participation requests"
  on public.participants for update
  using (
    exists (
      select 1
      from public.activities
      where activities.id = participants.activity_id
        and activities.organizer_id = auth.uid()
    )
  );

create policy "Users can read their notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their notifications read"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Authenticated users can create notifications"
  on public.notifications for insert
  with check (auth.uid() is not null);

create policy "Activity members can read messages"
  on public.activity_messages for select
  using (
    exists (
      select 1
      from public.activities
      where activities.id = activity_messages.activity_id
        and activities.organizer_id = auth.uid()
    )
    or exists (
      select 1
      from public.participants
      where participants.activity_id = activity_messages.activity_id
        and participants.user_id = auth.uid()
        and participants.status = 'accepted'
    )
  );

create policy "Activity members can send messages before closure"
  on public.activity_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.activities
      where activities.id = activity_messages.activity_id
        and activities.closed_at is null
        and (
          activities.organizer_id = auth.uid()
          or exists (
            select 1
            from public.participants
            where participants.activity_id = activity_messages.activity_id
              and participants.user_id = auth.uid()
              and participants.status = 'accepted'
          )
        )
    )
  );
