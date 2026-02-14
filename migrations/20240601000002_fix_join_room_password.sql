-- Fix join_room password check logic
-- Previous version had a bug where 'password != null' evaluated to null, bypassing the check

create or replace function public.join_room(p_room_id uuid, p_user_id uuid, p_password text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room public.rooms%rowtype;
  v_count int;
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

  -- Fix: Use IS DISTINCT FROM to handle NULL comparisons correctly
  if v_room.password is not null and v_room.password != '' and v_room.password is distinct from p_password then
    return jsonb_build_object('success', false, 'message', 'Invalid password');
  end if;

  -- Check if already joined
  if exists (select 1 from public.room_players where room_id = p_room_id and user_id = p_user_id) then
     return jsonb_build_object('success', true, 'room_id', p_room_id);
  end if;

  -- Insert player
  insert into public.room_players (room_id, user_id, seat_position)
  values (p_room_id, p_user_id, v_room.current_players); 

  -- Update room count
  update public.rooms set current_players = current_players + 1 where id = p_room_id;

  return jsonb_build_object('success', true, 'room_id', p_room_id);
end;
$$;
