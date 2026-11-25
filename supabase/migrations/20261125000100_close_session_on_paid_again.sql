-- 20261124/20261125 redefined mark_order_paid and dropped 20261122's rule: once nothing in a table session is
-- left to collect, the session closes, so the next scan of that QR starts a fresh visit. Restore it for both
-- whole-order and bill-share payments.
create or replace function close_session_if_settled(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_session_id is null then return; end if;
  -- Lock the table row like submit_order does, so a racing checkout cannot slip in after the check.
  perform 1 from tables t join table_sessions s on s.table_id = t.id where s.id = p_session_id for update of t;
  update table_sessions set status = 'closed', closed_at = now(), closed_by = auth.uid()
    where id = p_session_id and status = 'open'
      and not exists (select 1 from orders o where o.table_session_id = p_session_id
                        and o.payment_status = 'unpaid' and o.status not in ('rejected', 'cancelled'));
end $$;

create or replace function mark_order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  if v_order.status in ('cancelled', 'rejected') or (v_order.bill_split_id is not null and v_order.payment_status = 'unpaid')
    then raise exception 'not_payable'; end if;
  update orders set payment_status = 'paid', paid_at = now(), updated_at = now() where id = p_order_id and payment_status = 'unpaid';
  perform close_session_if_settled(v_order.table_session_id);
end $$;

create or replace function mark_share_paid(p_share_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_share bill_shares;
begin
  select * into v_share from bill_shares where id = p_share_id;
  if not found or not is_member(v_share.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  -- Lock the whole split so two waiters settling the last two shares can't both miss "all paid".
  perform 1 from bill_shares where split_id = v_share.split_id for update;
  update bill_shares set paid_at = now(), paid_by = auth.uid() where id = p_share_id and paid_at is null;
  if not exists (select 1 from bill_shares where split_id = v_share.split_id and paid_at is null) then
    update orders set payment_status = 'paid', paid_at = now(), updated_at = now()
      where bill_split_id = v_share.split_id and payment_status = 'unpaid';
    perform close_session_if_settled(v_share.table_session_id);
  end if;
end $$;

revoke execute on function close_session_if_settled from public, anon, authenticated;
