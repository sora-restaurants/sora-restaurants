# Juan review notes — payment foundation

Branch: `feature/payments-slide-confirm`
Main is untouched. No pull request has been opened.

## Task 1 — real PostgreSQL 17 verification

PostgreSQL 17.10 was started from the project's embedded-postgres binaries.
This sandbox cannot `setuid` or `chown`, and Postgres refuses to run as root.
The server was started inside a user namespace (`unshare --user --map-user=1000`)
so the process ran as a non-root uid. That is an environment workaround, not a
product change.

Verified on PostgreSQL 17.10 (`scripts/verify-payments-pg17.mjs`):

- All migrations, including the payment migrations, apply.
- `service_role` can create a counter payment. Amount comes from `orders.total_cents`.
- A waiter of the same restaurant can call `mark_counter_collected`. One audit row is written with that staff user id.
- A waiter of restaurant A cannot see restaurant B's payment.
- `anon` cannot select payments.
- Two concurrent counter creates for the same order leave exactly one `awaiting_collection` row.
- Two concurrent collections of the same payment produce one success and one audit row.

Unit suite on Node 22 after the auth grant: 90 passed, 1 skipped.

## Permissions added for sora_definer

- `SELECT` on `public.orders` only. No `UPDATE`, `INSERT`, or `DELETE` on orders.
- `EXECUTE` on `public.is_member(uuid, text[])`.
- `USAGE` on schema `auth` and `EXECUTE` on `auth.uid()`. Required so collection can record the staff user. Does not grant customers access to auth data.
- `EXECUTE` on `cancel_abandoned_demo` for `sora_definer` only.

No new grants to `anon`. `authenticated` remains select-only on the new tables.

## RLS

- `definer_lock_orders` on `orders`: `FOR SELECT TO sora_definer USING (true)`.
- Existing `staff_read` policies are unchanged.
- New payment tables have `staff_read` for authenticated members and `definer_all` for `sora_definer` only.
- `FORCE ROW LEVEL SECURITY` is on the new tables.

## Locking decision

Payment functions do not take `FOR UPDATE` on `orders`, because that requires `UPDATE` privilege.
They take `pg_advisory_xact_lock(hashtextextended(order_id::text, 0))`, then `FOR UPDATE` on the payment row.

Verified on PostgreSQL 17: this is enough to keep one active payment and one collection audit under concurrency.
It does not block other sessions from updating the order row itself. That is intentional.

## Not done yet

- Checkout is not connected to the payment functions.
- Service-request functions are not implemented.
- Real card processing is not enabled.
- Online payment before kitchen entry is not implemented. `submit_order` is unchanged.

## Task 2 — checkout connected server-side

- New `checkout` server function calls existing `submit_order`, then creates the payment.
- `submit_order` itself is unchanged. Kitchen movement and SSE are unchanged.
- Counter: `create_counter_payment`, status `awaiting_collection`. Not collected automatically.
- Online demo: `create_demo_payment`, then `simulate_payment_success` only on the server. Response is marked simulated.
- Client cannot send amount, status, or `is_simulated`. The schema is `.strict()`.
- Order ownership is checked by joining the returned status token to the QR token's table.
- Payment idempotency key is derived server-side from the order key and method.
- If the order is created but payment fails, the action returns `payment_incomplete` with the reference. Retry uses the same key and does not create a second order.
- Staff collection is a separate authenticated route that calls `mark_counter_collected` as the signed-in user.

## Slide confirmation

- Success state is set only after the server action returns success.
- Failure resets the knob and shows "Try again".
- Keyboard alternative remains. Arrow keys move the knob; Enter/Space confirms.
- `prefers-reduced-motion` disables the fill transition and spinner.
- Haptic vibration is used only if `navigator.vibrate` exists.
