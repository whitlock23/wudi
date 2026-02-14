-- Leave Room RPC
-- Handles player leaving, owner transfer, and room deletion if empty

create or replace function public.leave_room(
  p_room_id uuid,
  p_user_id uuid
) returns jsonb as $$
declare
  v_count int;
  v_room_owner_id uuid;
  v_next_owner_id uuid;
begin
  -- 0. Lock room first to prevent race conditions
  -- We use FOR UPDATE to serialize access to this room's state
  -- This ensures that concurrent leaves don't miss the "last person" check
  perform 1 from public.rooms where id = p_room_id for update;
  
  if not found then
     -- Room might have been deleted by another transaction just now
     return jsonb_build_object('success', true, 'message', 'Room already deleted');
  end if;

  -- 1. Remove player from room_players
  delete from public.room_players
  where room_id = p_room_id and user_id = p_user_id;

  -- 2. Get remaining count and current owner
  select count(*) into v_count from public.room_players where room_id = p_room_id;
  select owner_id into v_room_owner_id from public.rooms where id = p_room_id;

  -- 3. If room is empty, delete it
  if v_count = 0 then
    -- Delete associated games first (since no cascade on games.room_id in initial schema)
    delete from public.games where room_id = p_room_id;
    
    -- Delete room
    delete from public.rooms where id = p_room_id;
    
    return jsonb_build_object('success', true, 'message', 'Room deleted');
  else
    -- 4. Update player count
    update public.rooms
    set current_players = v_count
    where id = p_room_id;

    -- 5. Transfer ownership if owner left
    if v_room_owner_id = p_user_id then
      -- Pick the earliest joined player as new owner
      select user_id into v_next_owner_id
      from public.room_players
      where room_id = p_room_id
      order by joined_at asc
      limit 1;

      if v_next_owner_id is not null then
        update public.rooms
        set owner_id = v_next_owner_id
        where id = p_room_id;
      end if;
    end if;

    return jsonb_build_object('success', true, 'message', 'Left room');
  end if;
end;
$$ language plpgsql security definer;

-- Grant permissions
grant execute on function public.leave_room to anon, authenticated, service_role;
