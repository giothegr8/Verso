-- Create profiles table
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text unique not null,
  display_name text,
  preferred_language text,
  memorization_language text,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  revenuecat_customer_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text,
  entitlement text,
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create streaks table
create table public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_completed_date date,
  streak_protection_available integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create verse_progress table
create table public.verse_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  verse_reference text not null,
  translation text,
  language text,
  source_type text,
  source_id text,
  memorize_step integer default 1,
  completed boolean default false,
  last_practiced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create series_progress table
create table public.series_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  series_id text not null,
  current_verse_index integer default 0,
  completed_verse_count integer default 0,
  completed boolean default false,
  last_practiced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create paywall_events table
create table public.paywall_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  event_name text not null,
  plan_id text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.streaks enable row level security;
alter table public.verse_progress enable row level security;
alter table public.series_progress enable row level security;
alter table public.paywall_events enable row level security;

-- RLS Policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can view own subscription" on public.subscriptions for select using (auth.uid() = user_id);

create policy "Users can view own streak" on public.streaks for select using (auth.uid() = user_id);
create policy "Users can update own streak" on public.streaks for update using (auth.uid() = user_id);

create policy "Users can view own verse progress" on public.verse_progress for select using (auth.uid() = user_id);
create policy "Users can insert own verse progress" on public.verse_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own verse progress" on public.verse_progress for update using (auth.uid() = user_id);

create policy "Users can view own series progress" on public.series_progress for select using (auth.uid() = user_id);
create policy "Users can insert own series progress" on public.series_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own series progress" on public.series_progress for update using (auth.uid() = user_id);

create policy "Users can insert paywall events" on public.paywall_events for insert with check (auth.uid() = user_id or auth.role() = 'anon');
create policy "Users can view own paywall events" on public.paywall_events for select using (auth.uid() = user_id);

-- Trigger for profile creation on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
