# Vendor location inventory

## Order lifecycle review

| Event | Existing order behavior | Inventory behavior |
| --- | --- | --- |
| Checkout | Creates a `payment_pending` order, order items, pending payment, and collection-slot hold from the active cart. | `create_order_with_inventory` inserts the order, items, payment, slot hold, and reservations in one transaction after revalidating the cart, global item status, and slot. Reject checkout if an enabled location has missing or insufficient stock. |
| Payment succeeds | `process_mock_payment` moves the order through `submitted` to `payment_confirmed`. | Keep the reservation and clear its payment-hold expiry. |
| Payment fails | Payment becomes `failed`; the order remains `payment_pending` so payment can be retried. | Release stock. A later retry must reserve it again before marking payment successful. |
| Payment is cancelled | Payment and order become cancelled; the existing RPC releases the collection-slot hold. | Release stock once. |
| Customer cancels | `cancelMyOrder` moves eligible orders to `cancelled`. | Release stock once. |
| Vendor rejects | Vendor order status moves to `rejected`. | Release stock once. |
| Vendor confirms collection | Order moves to `collected` (and later `completed`). | Consume the reservation once: decrement both on-hand and reserved quantities. |
| Pending payment expires | No order-payment expiry worker previously existed. | Release stock and cancel stale pending orders through an idempotent expiry worker keyed to the reservation expiry (or the 15-minute checkout window when tracking is off). |

Order transitions remain split across controller calls, while mock payment and the new checkout path are transactional. Inventory mutations therefore live in service-role database functions and database triggers, so status changes and stock movements commit or roll back together. Refunds after fulfilment are intentionally outside this phase: consumed reservations are not silently restocked.

## Inventory model

- Keep `menu_item_inventory` and its data unchanged; it is menu-scoped legacy data and is not safe to backfill automatically.
- Add location-level inventory settings. Tracking is disabled by default to preserve current ordering until a manager has loaded stock for every active item at that location.
- Store on-hand and reserved quantities per `(vendor_location_id, menu_item_id)`. Orderable quantity is `on_hand_quantity - reserved_quantity`.
- Store one current reservation row per order item, with a reservation attempt counter so a failed-payment retry can reserve again without duplicating history.
- Store every adjustment, reservation, release, and consumption in an append-only movement ledger with a unique idempotency key. A trigger rejects ledger updates and deletes.
- Reject enabling tracking until every active catalogue item has a stock row at that location. The manager **Location stock** page loads paginated stock rows and saves corrections through the per-item RPC; the complete-location bulk endpoint remains available for initial setup. Reject disabling tracking while reservations remain active.
- Keep vendor-wide `menu_items.status` as the global sale gate. A location with tracking enabled additionally requires positive location stock.
- Use a 15-minute payment hold. Payment confirmation removes the expiry; payment failure releases the hold; payment retry reserves again; collection consumes it.

## Rollout order

1. Apply migration 029 from a role with `BYPASSRLS` (the Supabase migration role), before deploying dependent API code.
2. Deploy server inventory APIs, the atomic checkout RPC, payment/cancellation/rejection/collection lifecycle hooks, and expiry worker.
3. Deploy manager stock controls. Managers use the sidebar **Location stock** page to review paginated stock, save each quantity, and then explicitly enable tracking there.
4. Verify concurrent checkout, payment retry/failure/expiry, cancellation, rejection, consume, and duplicate release/consume attempts in staging before enabling tracking in production.

Do not enable tracking at a location until its complete catalogue stock has been entered and reviewed.
