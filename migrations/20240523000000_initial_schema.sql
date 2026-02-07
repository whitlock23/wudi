-- Create a table for public profiles
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  username text unique not null,
  total_score integer default 0,
  games_played integer default 0,
  games_won integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.users enable row level security;

create policy "Public profiles are viewable by everyone." on public.users
  for select using (true);

create policy "Users can insert their own profile." on public.users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.users
  for update using (auth.uid() = id);

-- Rooms table
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  password text,
  join_code text unique not null,
  owner_id uuid references public.users(id) not null,
  status text default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  current_players integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.rooms enable row level security;

create policy "Rooms are viewable by everyone." on public.rooms
  for select using (true);

create policy "Authenticated users can create rooms." on public.rooms
  for insert with check (auth.role() = 'authenticated');

create policy "Room owner can update room." on public.rooms
  for update using (auth.uid() = owner_id);

-- Room Players
create table public.room_players (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  is_ready boolean default false,
  seat_position integer,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_id, user_id)
);

alter table public.room_players enable row level security;

create policy "Room players are viewable by everyone." on public.room_players
  for select using (true);

create policy "Authenticated users can join rooms." on public.room_players
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own status." on public.room_players
  for update using (auth.uid() = user_id);
  
create policy "Users can leave room (delete)." on public.room_players
  for delete using (auth.uid() = user_id);

-- Games table
create table public.games (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) not null,
  status text default 'preparing' check (status in ('preparing', 'playing', 'finished')),
  game_state jsonb default '{}'::jsonb,
  current_player_id uuid references public.users(id),
  winner_id uuid references public.users(id),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.games enable row level security;

create policy "Games are viewable by everyone." on public.games
  for select using (true);

create policy "Room owner can start game." on public.games
  for insert with check (exists (
    select 1 from public.rooms
    where id = room_id and owner_id = auth.uid()
  ));

create policy "Players can update game state." on public.games
  for update using (
    exists (
      select 1 from public.room_players
      where room_id = games.room_id and user_id = auth.uid()
    )
  );

-- Game Players (Snapshot for a specific game)
create table public.game_players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.games(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  hand_cards jsonb default '[]'::jsonb,
  cards_count integer default 0,
  is_landlord boolean default false,
  is_invincible boolean default false, -- 拿到红桃2和方片2
  score_change integer default 0,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_id, user_id)
);

alter table public.game_players enable row level security;

create policy "Game players are viewable by everyone." on public.game_players
  for select using (true);

-- Only system/server logic should ideally insert/update this, but for client-side game logic:
create policy "Authenticated users can insert game players." on public.game_players
  for insert with check (auth.role() = 'authenticated');

create policy "Players can update their own hand." on public.game_players
  for update using (auth.uid() = user_id);

-- Game Moves (History)
create table public.game_moves (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.games(id) on delete cascade not null,
  player_id uuid references public.users(id) not null,
  cards_played jsonb not null,
  move_type text not null, -- 'play' or 'pass'
  played_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.game_moves enable row level security;

create policy "Game moves are viewable by everyone." on public.game_moves
  for select using (true);

create policy "Players can record moves." on public.game_moves
  for insert with check (auth.uid() = player_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, username)
  values (new.id, new.email, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
