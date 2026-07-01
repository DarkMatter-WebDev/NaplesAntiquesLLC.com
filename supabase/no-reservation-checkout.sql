-- Remove product reservation from the checkout flow.
-- Items stay 'available' until payment is actually captured.
-- "Whoever pays first gets the item."
--
-- Run in the Supabase SQL Editor AFTER paypal-checkout.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- create_paypal_order: create order + order_items without reserving products.
-- Products remain 'available' so concurrent buyers can all proceed to PayPal;
-- the capture step resolves any race atomically.
-- ---------------------------------------------------------------------------
create or replace function public.create_paypal_order(
  order_payload jsonb,
  items_payload jsonb
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_order_id uuid;
  inserted_order_number text;
  item jsonb;
  product_ids uuid[];
  unavailable_titles text;
begin
  if jsonb_typeof(items_payload) <> 'array' or jsonb_array_length(items_payload) = 0 then
    raise exception 'Order must include at least one item.';
  end if;

  select array_agg((value->>'product_id')::uuid)
  into product_ids
  from jsonb_array_elements(items_payload)
  where value->>'product_id' is not null;

  -- Snapshot availability check (no lock — concurrent buyers are allowed through;
  -- the capture RPC serializes the final sale with row-level locking).
  select string_agg(p.title, ', ')
  into unavailable_titles
  from public.products p
  where p.id = any(product_ids)
    and lower(replace(coalesce(p.status, ''), ' ', '_')) <> 'available';

  if unavailable_titles is not null then
    raise exception 'One or more items are no longer available: %', unavailable_titles
      using errcode = 'P0001';
  end if;

  insert into public.orders (
    order_number, user_id, customer_name, customer_email, customer_phone,
    subtotal, tax, shipping_fee, discount, total,
    payment_status, fulfillment_status, order_status,
    payment_method, shipping_method, shipping_address, billing_address,
    internal_notes, customer_notes
  )
  values (
    order_payload->>'order_number',
    nullif(order_payload->>'user_id', '')::uuid,
    order_payload->>'customer_name',
    order_payload->>'customer_email',
    order_payload->>'customer_phone',
    coalesce((order_payload->>'subtotal')::numeric, 0),
    coalesce((order_payload->>'tax')::numeric, 0),
    coalesce((order_payload->>'shipping_fee')::numeric, 0),
    coalesce((order_payload->>'discount')::numeric, 0),
    coalesce((order_payload->>'total')::numeric, 0),
    'unpaid',
    'pending',
    'open',
    coalesce(order_payload->>'payment_method', 'paypal'),
    coalesce(order_payload->>'shipping_method', 'pickup'),
    order_payload->'shipping_address',
    order_payload->'billing_address',
    order_payload->>'internal_notes',
    order_payload->>'customer_notes'
  )
  returning id, orders.order_number into inserted_order_id, inserted_order_number;

  for item in select * from jsonb_array_elements(items_payload)
  loop
    insert into public.order_items (
      order_id, product_id, inventory_number, title_snapshot, item_year_snapshot,
      metal_snapshot, purity_snapshot, gram_weight_snapshot, price_snapshot, image_snapshot
    )
    values (
      inserted_order_id,
      item->>'product_id',
      item->>'inventory_number',
      item->>'title_snapshot',
      nullif(item->>'item_year_snapshot', '')::smallint,
      item->>'metal_snapshot',
      item->>'purity_snapshot',
      nullif(item->>'gram_weight_snapshot', '')::numeric,
      coalesce((item->>'price_snapshot')::numeric, 0),
      item->>'image_snapshot'
    );
  end loop;

  -- Products intentionally NOT reserved — they stay 'available'.

  return query select inserted_order_id, inserted_order_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- capture_paypal_order (updated): lock product rows to serialize concurrent
-- captures, detect items already sold to another buyer, and return an
-- item_conflict flag so the route can surface an appropriate error.
-- Must drop first because the return type gains a new column (item_conflict).
-- ---------------------------------------------------------------------------
drop function if exists public.capture_paypal_order(uuid, text, jsonb);
create or replace function public.capture_paypal_order(
  p_order_id uuid,
  p_capture_id text,
  p_payment_response jsonb
)
returns table(order_id uuid, order_number text, already_paid boolean, item_conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing record;
  conflicted_titles text;
begin
  -- Lock the order row first.
  select id, orders.order_number, payment_status
  into existing
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found.', p_order_id using errcode = 'P0002';
  end if;

  if existing.payment_status = 'paid' then
    return query select existing.id, existing.order_number, true, false;
    return;
  end if;

  -- Lock the product rows to prevent two concurrent captures from both selling
  -- the same item. The second caller blocks here until the first transaction commits.
  perform 1
  from public.products p
  join public.order_items oi on oi.product_id = p.id
  where oi.order_id = p_order_id and oi.product_id is not null
  for update;

  -- After acquiring locks, check if any item is already sold to a different buyer.
  select string_agg(p.title, ', ')
  into conflicted_titles
  from public.products p
  join public.order_items oi on oi.product_id = p.id
  where oi.order_id = p_order_id
    and lower(replace(coalesce(p.status, ''), ' ', '_')) = 'sold';

  if conflicted_titles is not null then
    -- Another buyer paid first. Flag this order for admin review + manual refund.
    update public.orders
    set payment_status  = 'failed',
        internal_notes  = coalesce(internal_notes || ' | ', '') ||
                          'Payment captured but item(s) already sold to another buyer: ' ||
                          conflicted_titles || '. Manual PayPal refund required.',
        payment_response = p_payment_response
    where id = p_order_id;

    return query select existing.id, existing.order_number, false, true;
    return;
  end if;

  -- Clear — mark the order paid and the products sold.
  update public.orders
  set payment_status    = 'paid',
      order_status      = 'completed',
      payment_method    = 'paypal',
      payment_reference = p_capture_id,
      paypal_capture_id = p_capture_id,
      payment_response  = p_payment_response,
      paid_at           = now(),
      reserved_until    = null
  where id = p_order_id;

  update public.products
  set status           = 'sold',
      reserved_until   = null,
      reserved_order_id = null
  where id in (
    select oi.product_id from public.order_items oi
    where oi.order_id = p_order_id and oi.product_id is not null
  );

  return query select existing.id, existing.order_number, false, false;
end;
$$;

-- Grant the new creation function to service_role only (called from server-side
-- API routes, not from the browser). The old reserve_paypal_order grant to
-- anon/authenticated is intentionally NOT carried over.
grant execute on function public.create_paypal_order(jsonb, jsonb) to service_role;

-- capture_paypal_order already has a service_role grant from paypal-checkout.sql.
-- Re-grant to be safe after the replace.
grant execute on function public.capture_paypal_order(uuid, text, jsonb) to service_role;
