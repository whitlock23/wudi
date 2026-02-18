-- 1. Add missing columns to support game logic
alter table public.game_players add column if not exists played_times int default 0;
alter table public.game_players add column if not exists is_h2_owner boolean default false;
alter table public.game_players add column if not exists is_d2_owner boolean default false;

-- 2. Update start_game to populate new columns
create or replace function public.start_game(
  p_room_id uuid,
  p_hands jsonb,
  p_landlord_cards jsonb,
  p_first_player_id uuid,
  p_invincible_player_id uuid default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_game_id uuid;
  v_player record;
  v_hand jsonb;
  v_is_landlord boolean;
  v_is_invincible boolean;
  v_count int;
  v_has_h2 boolean;
  v_has_d2 boolean;
begin
  -- Create Game
  insert into public.games (room_id, status, current_player_id, started_at)
  values (p_room_id, 'playing', p_first_player_id, now())
  returning id into v_game_id;
  
  -- Create Game Players
  for v_player in select * from public.room_players where room_id = p_room_id loop
    v_hand := p_hands->(v_player.user_id::text);
    v_is_landlord := (v_player.user_id = p_first_player_id);
    v_is_invincible := (v_player.user_id = p_invincible_player_id);
    
    if v_hand is null then
        v_hand := '[]'::jsonb;
    end if;
    
    v_count := jsonb_array_length(v_hand);
    
    -- Check for H2 and D2
    v_has_h2 := exists (select 1 from jsonb_array_elements(v_hand) c where c->>'suit' = 'hearts' and c->>'rank' = '2');
    v_has_d2 := exists (select 1 from jsonb_array_elements(v_hand) c where c->>'suit' = 'diamonds' and c->>'rank' = '2');
    
    insert into public.game_players (game_id, user_id, hand_cards, cards_count, is_landlord, is_invincible, is_h2_owner, is_d2_owner)
    values (v_game_id, v_player.user_id, v_hand, v_count, v_is_landlord, v_is_invincible, v_has_h2, v_has_d2);
  end loop;
  
  -- Update Room Status
  update public.rooms set status = 'playing' where id = p_room_id;
end;
$$;

-- 3. Create play_cards function
create or replace function public.play_cards(
  p_game_id uuid,
  p_player_id uuid,
  p_cards jsonb,
  p_move_type text
)
returns void
language plpgsql
security definer
as $$
declare
  v_game public.games%rowtype;
  v_player public.game_players%rowtype;
  v_hand jsonb;
  v_new_hand jsonb;
  v_cards_count int;
  v_played_ids text[];
  v_multiplier int;
  v_base_score int;
  v_moves_count int;
  v_has_spade3 boolean;
  v_playing_spade3 boolean;
  v_next_player_id uuid;
  v_current_idx int;
  v_next_idx int;
  v_winner_id uuid;
  v_score int;
  v_invincible_player public.game_players%rowtype;
  v_all_user_ids uuid[];
  v_is_spring boolean := false;
  v_team1_exists boolean;
  v_winner_is_team1 boolean;
begin
  -- Get Game
  select * into v_game from public.games where id = p_game_id;
  if not found then raise exception 'Game not found'; end if;
  if v_game.status <> 'playing' then raise exception 'Game not playing'; end if;
  if v_game.current_player_id <> p_player_id then raise exception 'Not your turn'; end if;

  -- Get Player
  select * into v_player from public.game_players where game_id = p_game_id and user_id = p_player_id;
  if not found then raise exception 'Player not found'; end if;

  -- Spade 3 Check
  select count(*) into v_moves_count from public.game_moves where game_id = p_game_id;
  if v_moves_count = 0 then
    v_has_spade3 := exists (
      select 1 from jsonb_array_elements(v_player.hand_cards) c
      where c->>'suit' = 'spades' and c->>'rank' = '3'
    );
    
    if v_has_spade3 then
       v_playing_spade3 := exists (
         select 1 from jsonb_array_elements(p_cards) c
         where c->>'suit' = 'spades' and c->>'rank' = '3'
       );
       if not v_playing_spade3 then
         raise exception 'First move must include Spade 3';
       end if;
    end if;
  end if;

  -- Update Hand
  select array_agg(c->>'id') into v_played_ids from jsonb_array_elements(p_cards) c;
  
  select jsonb_agg(elem) into v_new_hand
  from jsonb_array_elements(v_player.hand_cards) elem
  where not (elem->>'id' = any(v_played_ids));
  
  if v_new_hand is null then v_new_hand := '[]'::jsonb; end if;
  v_cards_count := jsonb_array_length(v_new_hand);

  update public.game_players
  set hand_cards = v_new_hand,
      cards_count = v_cards_count,
      played_times = coalesce(played_times, 0) + 1
  where id = v_player.id;

  -- Multiplier
  v_multiplier := coalesce((v_game.game_state->>'multiplier')::int, 1);
  v_base_score := coalesce((v_game.game_state->>'base_score')::int, 1);
  
  if p_move_type = 'bomb' then
    v_multiplier := v_multiplier * 2;
  elsif p_move_type = 'invincible_bomb' then
    v_multiplier := v_multiplier * 4;
  end if;

  if v_multiplier <> coalesce((v_game.game_state->>'multiplier')::int, 1) then
    update public.games 
    set game_state = jsonb_set(game_state, '{multiplier}', to_jsonb(v_multiplier))
    where id = p_game_id;
  end if;

  -- Insert Move
  insert into public.game_moves (game_id, player_id, cards_played, move_type, played_at)
  values (p_game_id, p_player_id, p_cards, p_move_type, now());

  -- Check Win
  if v_cards_count = 0 then
    v_winner_id := p_player_id;
    
    update public.games 
    set status = 'finished', winner_id = v_winner_id, ended_at = now()
    where id = p_game_id;
    
    update public.rooms set status = 'finished' where id = v_game.room_id;

    -- Scoring
    select * into v_invincible_player from public.game_players where game_id = p_game_id and is_invincible = true limit 1;
    
    -- Spring Check
    if found then -- 1v3 Mode
       if v_invincible_player.user_id = v_winner_id then
          -- Invincible Wins. Spring if all peasants played 0 times.
          if not exists (select 1 from public.game_players where game_id = p_game_id and is_invincible = false and played_times > 0) then
             v_is_spring := true;
          end if;
       else
          -- Peasants Win. Spring if Invincible played only 1 time.
          if v_invincible_player.played_times = 1 then
             v_is_spring := true;
          end if;
       end if;
    else -- 2v2 Mode
       -- Team 1: H2 owner + D2 owner
       -- If winner is in Team 1, check if Team 2 played 0 times.
       -- If winner is in Team 2, check if Team 1 played 0 times.
       select exists(select 1 from public.game_players where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true)) into v_team1_exists;
       
       if v_team1_exists then
           select (is_h2_owner or is_d2_owner) into v_winner_is_team1 from public.game_players where game_id = p_game_id and user_id = v_winner_id;
           
           if v_winner_is_team1 then
               -- Check Team 2 (Not H2 or D2)
               if not exists (select 1 from public.game_players where game_id = p_game_id and is_h2_owner = false and is_d2_owner = false and played_times > 0) then
                   v_is_spring := true;
               end if;
           else
               -- Check Team 1 (H2 or D2)
               if not exists (select 1 from public.game_players where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true) and played_times > 0) then
                   v_is_spring := true;
               else
                   -- Reverse Spring Logic (Anti-Spring)
                   -- If the losing team (Team 1) was the start player AND only played 1 time, it counts as spring.
                   -- Actually, "played_times" counts how many times they successfully played cards.
                   -- If Team 1 started, they played once. If they never played again, played_times = 1.
                   -- We need to know who started. But played_times = 1 is a good proxy if they lost badly.
                   -- Wait, if they are not start player and played 1 time, it means they intercepted once. That is NOT spring.
                   -- Anti-Spring specifically refers to Landlord (or Team 1) playing only the FIRST hand and nothing else.
                   -- So we must check if the single play was the FIRST move of the game.
                   
                   -- Simplify: If Team 1 played exactly 1 time, AND that 1 time was the VERY FIRST move of the game.
                   if (select count(*) from public.game_players where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true) and played_times = 1) > 0 then
                        -- Check if the first move was made by Team 1
                        declare
                            v_first_player_id uuid;
                        begin
                            select player_id into v_first_player_id from public.game_moves where game_id = p_game_id order by played_at asc limit 1;
                            if exists (select 1 from public.game_players where game_id = p_game_id and user_id = v_first_player_id and (is_h2_owner = true or is_d2_owner = true)) then
                                 -- Also ensure no other member of Team 1 played more than 0 times (except the starter who played 1)
                                 -- Actually, "played_times" is per player.
                                 -- If Team 1 has 2 players. Player A started (1). Player B played 0.
                                 -- If Player A played 2 times, no spring.
                                 -- So condition: Sum of played_times for Team 1 is 1.
                                 if (select sum(played_times) from public.game_players where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true)) = 1 then
                                     v_is_spring := true;
                                 end if;
                            end if;
                        end;
                   end if;
               end if;
           end if;
       end if;
    end if;

    if v_is_spring then
        v_multiplier := v_multiplier * 2;
        -- Update final multiplier in game state for UI
        update public.games 
        set game_state = jsonb_set(game_state, '{multiplier}', to_jsonb(v_multiplier))
        where id = p_game_id;
    end if;

    v_score := v_base_score * v_multiplier;
    
    if found then -- 1v3 Scoring
       if v_invincible_player.user_id = v_winner_id then
          update public.game_players set score_change = 3 * v_score where game_id = p_game_id and user_id = v_winner_id;
          update public.game_players set score_change = -v_score where game_id = p_game_id and user_id <> v_winner_id;
       else
          update public.game_players set score_change = -3 * v_score where game_id = p_game_id and user_id = v_invincible_player.user_id;
          update public.game_players set score_change = v_score where game_id = p_game_id and user_id <> v_invincible_player.user_id;
       end if;
    else -- 2v2 Scoring
       if v_team1_exists then
           -- Edge Case: 1 player has BOTH H2 and D2. Then it is actually 1v3 (Team 1 has 1 person, Team 2 has 3).
           -- Check if Team 1 has only 1 member.
           if (select count(*) from public.game_players where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true)) = 1 then
               -- Treat as 1v3
               if v_winner_is_team1 then
                   -- Team 1 (1 person) Wins: +3*score, others -score
                   update public.game_players set score_change = 3 * v_score where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true);
                   update public.game_players set score_change = -v_score where game_id = p_game_id and not (is_h2_owner = true or is_d2_owner = true);
               else
                   -- Team 2 (3 people) Wins: Team 1 -3*score, others +score
                   update public.game_players set score_change = -3 * v_score where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true);
                   update public.game_players set score_change = v_score where game_id = p_game_id and not (is_h2_owner = true or is_d2_owner = true);
               end if;
           else
               -- Normal 2v2
               if v_winner_is_team1 then
                   update public.game_players set score_change = v_score where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true);
                   update public.game_players set score_change = -v_score where game_id = p_game_id and not (is_h2_owner = true or is_d2_owner = true);
               else
                   update public.game_players set score_change = -v_score where game_id = p_game_id and (is_h2_owner = true or is_d2_owner = true);
                   update public.game_players set score_change = v_score where game_id = p_game_id and not (is_h2_owner = true or is_d2_owner = true);
               end if;
           end if;
       else
           -- Fallback: Winner +3*score, others -score (Treat as 1v3 with winner as landlord)
           update public.game_players set score_change = 3 * v_score where game_id = p_game_id and user_id = v_winner_id;
           update public.game_players set score_change = -v_score where game_id = p_game_id and user_id <> v_winner_id;
       end if;
    end if;
    
    update public.users u
    set total_score = u.total_score + gp.score_change
    from public.game_players gp
    where gp.user_id = u.id and gp.game_id = p_game_id;
    
    return;
  end if;

  -- Next Player
  select array_agg(user_id order by seat_position) into v_all_user_ids
  from public.room_players
  where room_id = v_game.room_id;
  
  select array_position(v_all_user_ids, p_player_id) into v_current_idx;
  v_next_idx := (v_current_idx % array_length(v_all_user_ids, 1)) + 1;
  v_next_player_id := v_all_user_ids[v_next_idx];
  
  update public.games set current_player_id = v_next_player_id where id = p_game_id;
end;
$$;

-- 4. Create pass_turn function
create or replace function public.pass_turn(
  p_game_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_game public.games%rowtype;
  v_all_user_ids uuid[];
  v_next_player_id uuid;
  v_current_idx int;
  v_next_idx int;
  v_last_play_player_id uuid;
begin
  select * into v_game from public.games where id = p_game_id;
  if not found then raise exception 'Game not found'; end if;
  if v_game.current_player_id <> p_player_id then raise exception 'Not your turn'; end if;

  -- Check if free turn
  select player_id into v_last_play_player_id 
  from public.game_moves 
  where game_id = p_game_id 
    and move_type in ('play', 'bomb', 'invincible_bomb')
  order by played_at desc 
  limit 1;
  
  if v_last_play_player_id is null then
      raise exception 'Cannot pass on first turn';
  end if;
  
  if v_last_play_player_id = p_player_id then
      raise exception 'Cannot pass on free turn';
  end if;

  insert into public.game_moves (game_id, player_id, cards_played, move_type, played_at)
  values (p_game_id, p_player_id, '[]'::jsonb, 'pass', now());

  select array_agg(user_id order by seat_position) into v_all_user_ids
  from public.room_players
  where room_id = v_game.room_id;
  
  select array_position(v_all_user_ids, p_player_id) into v_current_idx;
  v_next_idx := (v_current_idx % array_length(v_all_user_ids, 1)) + 1;
  v_next_player_id := v_all_user_ids[v_next_idx];
  
  update public.games set current_player_id = v_next_player_id where id = p_game_id;
end;
$$;

-- Grant permissions
grant execute on function public.play_cards to authenticated;
grant execute on function public.pass_turn to authenticated;
grant execute on function public.play_cards to service_role;
grant execute on function public.pass_turn to service_role;
