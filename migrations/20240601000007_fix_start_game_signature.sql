-- Fix start_game function signature to match frontend call
-- Frontend sends: p_room_id, p_hands, p_landlord_cards, p_first_player_id, p_invincible_player_id
-- We need a function that accepts all these arguments.

-- Drop potential conflicting functions
drop function if exists public.start_game(uuid, jsonb, uuid);
drop function if exists public.start_game(uuid, jsonb, uuid, uuid);
drop function if exists public.start_game(uuid, jsonb, jsonb, uuid);

create or replace function public.start_game(
  p_room_id uuid,
  p_hands jsonb,
  p_landlord_cards jsonb, -- Kept for compatibility
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
    
    insert into public.game_players (game_id, user_id, hand_cards, cards_count, is_landlord, is_invincible)
    values (v_game_id, v_player.user_id, v_hand, v_count, v_is_landlord, v_is_invincible);
  end loop;
  
  -- Update Room Status
  update public.rooms set status = 'playing' where id = p_room_id;
end;
$$;

-- Grant permissions
grant execute on function public.start_game to authenticated;
grant execute on function public.start_game to service_role;
