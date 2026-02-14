create or replace function public.toggle_ready(
  p_room_id uuid,
  p_user_id uuid,
  p_is_ready boolean
)
returns void
language plpgsql
security definer
as $$
begin
  update public.room_players
  set is_ready = p_is_ready
  where room_id = p_room_id and user_id = p_user_id;
end;
$$;

grant execute on function public.toggle_ready to anon, authenticated, service_role;
