-- Fix join_room seat allocation logic
-- Previously used current_players count which caused seat conflicts when players left

create or replace function public.join_room(p_room_id uuid, p_user_id uuid, p_password text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room public.rooms%rowtype;
  v_seat int;
begin
  -- Lock room row for update to prevent race conditions
  select * into v_room from public.rooms where id = p_room_id for update;
  
  if not found then
    return jsonb_build_object('success', false, 'message', 'Room not found');
  end if;

  if v_room.status != 'waiting' then
    return jsonb_build_object('success', false, 'message', 'Game already started');
  end if;

  if v_room.current_players >= 4 then
    return jsonb_build_object('success', false, 'message', 'Room is full');
  end if;

  -- Password check
  if v_room.password is not null and v_room.password != '' and v_room.password is distinct from p_password then
    return jsonb_build_object('success', false, 'message', 'Invalid password');
  end if;

  -- Check if already joined
  if exists (select 1 from public.room_players where room_id = p_room_id and user_id = p_user_id) then
     return jsonb_build_object('success', true, 'room_id', p_room_id);
  end if;

  -- Find first available seat (0-3)
  select s.seat into v_seat
  from generate_series(0, 3) s(seat)
  where not exists (
    select 1 from public.room_players 
    where room_id = p_room_id and seat_position = s.seat
  )
  order by s.seat
  limit 1;

  -- Fallback (should not happen if count < 4)
  if v_seat is null then
     v_seat := v_room.current_players;
  end if;

  -- Insert player
  insert into public.room_players (room_id, user_id, seat_position)
  values (p_room_id, p_user_id, v_seat); 

  -- Update room count
  update public.rooms set current_players = current_players + 1 where id = p_room_id;

  return jsonb_build_object('success', true, 'room_id', p_room_id);
end;
$$;
