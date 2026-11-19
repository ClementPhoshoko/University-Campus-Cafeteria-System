# Collection slot controls — verification runbook

Run these checks after applying `migrations/030_vendor_collection_slot_controls.sql` to the target Supabase project. Do not enable the manager UI for a live vendor until every row passes.

## 1. Migration applied and locked down

```sql
select p.proname, p.prosecdef, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'set_vendor_collection_slot_paused';
```

Expected: one row, `prosecdef = true`, and `proacl` grants execute to `service_role` only (no `anon`/`authenticated`/public).

## 2. Manager read is scoped and paginated

```text
GET /api/v1/vendor/collection-slots?vendor_id={own}&vendor_location_id={own-location}&page=1&limit=8
```

Expected: `200`, one page of `slots`, `counts` describing the whole location, and `locations` containing only that manager's active locations. Request page 2 and confirm different rows.

## 3. Authorization boundaries

| Caller / payload | Expected |
|---|---|
| Staff account | `403 VENDOR_MANAGER_REQUIRED` |
| Manager with another vendor's `vendor_id` | `403 VENDOR_MANAGER_REQUIRED` |
| Manager with another vendor's `vendor_location_id` | `404 VENDOR_LOCATION_NOT_FOUND` |
| Manager with a slot from another location | `404 COLLECTION_SLOT_NOT_FOUND` |

Confirm no slot row changed in the database for any denied call.

## 4. Pause/resume guards

| Scenario | Expected |
|---|---|
| Future slot, `reserved_count = 0`, `paused = false` → pause | `200`, slot paused, one audit row |
| Same slot → resume | `200`, slot available, second audit row |
| Pause a slot whose `starts_at <= now()` | `409 COLLECTION_SLOT_STARTED`, no change, no audit row |
| Pause a slot with `reserved_count > 0` | `409 COLLECTION_SLOT_HAS_RESERVATIONS`, no change, no audit row |
| Repeat an already-applied pause with a new request key | `200`, `unchanged: true`, no extra audit row |

Audit check:

```sql
select created_at, actor_user_id, reason, old_data, new_data
from public.audit_logs
where table_name = 'public.collection_slots'
  and record_key = '{slot-id}'
order by created_at desc;
```

`actor_user_id` must be the manager's profile id, and `new_data` must contain `paused`, `vendor_location_id`, `starts_at`, and `idempotency_key`.

## 5. Customer-facing enforcement

1. With a slot paused, call `GET /api/v1/vendor-locations/{location}/collection-slots`. Expected: the slot is absent.
2. Force checkout with that `collection_slot_id` for a cart at the same location. Expected: `409 SLOT_PAUSED` from both the controller pre-check and, if bypassed, the RPC recheck.
3. Fill a slot to capacity. Expected: customer UI shows `Full`, and checkout returns `409 SLOT_FULL`.
4. Pause and resume a slot, then confirm `GET /api/v1/vendor/collection-slots` still reports the original `reserved_count`. A pause must never release reservations.

## 6. Scheduler interaction

Confirm the daily `refreshCollectionSlots()` run does not silently resume a manager-paused slot: after a refresh, the slot should still be `paused = true`. Obsolete slots outside the generated schedule may still be deleted when empty or paused when reserved.

## 7. UI smoke check

- Sidebar shows **Collection slots** only to managers.
- Location dropdown lists only the manager's active locations.
- Rows show collection time in the site timezone, a capacity bar, and the correct state badge.
- Pause is disabled for started slots and for slots with reservations, with an explanatory tooltip.
- Pagination fetches a new server page; no full slot list is assembled in the browser.
- Reason and refresh controls behave as on the Location stock page.
