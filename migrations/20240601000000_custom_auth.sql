-- Migration to switch to Custom Auth (Username/Password)
-- Disables dependency on Supabase Auth (gotrue)

-- 1. Enable pgcrypto for password hashing
create extension if not exists "pgcrypto";

-- 2. Modify users table to be independent
-- Drop foreign key if exists (generic name)
do $$ 
begin
  if exists (select 1 from pg_constraint where conname = 'users_id_fkey') then
    alter table public.users drop constraint users_id_fkey;
  end if;
end $$;

-- Add password_hash column
alter table public.users add column if not exists password_hash text;

-- 3. Register RPC
create or replace function public.register_user(
  p_username text,
  p_password text
) returns jsonb as $$
declare
  v_user_id uuid;
  v_exists boolean;
begin
  -- Check if username exists
  select exists(select 1 from public.users where username = p_username) into v_exists;
  if v_exists then
    return jsonb_build_object('success', false, 'message', '该用户名已被注册');
  end if;

  v_user_id := gen_random_uuid();
  
  insert into public.users (id, username, email, password_hash)
  values (
    v_user_id, 
    p_username, 
    p_username || '@local.game', -- Dummy email
    crypt(p_password, gen_salt('bf'))
  );
  
  return jsonb_build_object(
    'success', true, 
    'user', jsonb_build_object(
      'id', v_user_id, 
      'username', p_username
    )
  );
end;
$$ language plpgsql security definer;

-- 4. Login RPC
create or replace function public.login_user(
  p_username text,
  p_password text
) returns jsonb as $$
declare
  v_user record;
begin
  select * from public.users where username = p_username into v_user;
  
  if v_user is null then
    return jsonb_build_object('success', false, 'message', '用户不存在');
  end if;
  
  if v_user.password_hash = crypt(p_password, v_user.password_hash) then
    return jsonb_build_object(
      'success', true, 
      'user', jsonb_build_object(
        'id', v_user.id, 
        'username', v_user.username
      )
    );
  else
    return jsonb_build_object('success', false, 'message', '密码错误');
  end if;
end;
$$ language plpgsql security definer;

-- 5. Create Room RPC (Bypassing RLS)
create or replace function public.create_room_custom(
  p_name text,
  p_owner_id uuid,
  p_password text default null
) returns jsonb as $$
declare
  v_room_id uuid;
  v_join_code text;
begin
  -- Generate 6 char random code
  v_join_code := upper(substring(md5(random()::text) from 1 for 6));
  
  insert into public.rooms (name, owner_id, password, join_code, status, current_players)
  values (p_name, p_owner_id, p_password, v_join_code, 'waiting', 0)
  returning id into v_room_id;
  
  return jsonb_build_object('success', true, 'room_id', v_room_id, 'join_code', v_join_code);
end;
$$ language plpgsql security definer;

-- 6. Grant permissions to anon (since we are not using auth.uid())
grant execute on function public.register_user to anon, authenticated, service_role;
grant execute on function public.login_user to anon, authenticated, service_role;
grant execute on function public.create_room_custom to anon, authenticated, service_role;
