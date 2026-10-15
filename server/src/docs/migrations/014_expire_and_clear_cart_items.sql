-- Atomically mark an expired cart and clear its cart lines while retaining
-- the cart record for history and expiry notifications.
update public.carts
   set status = 'expired',
       updated_at = now()
 where status = 'active'
   and expires_at <= now();

delete from public.cart_items ci
 using public.carts c
 where c.id = ci.cart_id
   and c.status = 'expired';

create or replace function public.expire_cart_and_clear_items(
  p_cart_id uuid,
  p_now timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.cart_status;
  v_expires_at timestamptz;
begin
  select status, expires_at
    into v_status, v_expires_at
    from public.carts
   where id = p_cart_id
   for update;

  if not found or v_status <> 'active' or v_expires_at > p_now then
    return false;
  end if;

  update public.carts
     set status = 'expired',
         updated_at = p_now
   where id = p_cart_id;

  delete from public.cart_items
   where cart_id = p_cart_id;

  return true;
end;
$$;

revoke all on function public.expire_cart_and_clear_items(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.expire_cart_and_clear_items(uuid, timestamptz) to service_role;
