# Corporate catering foundation — verification runbook

Run these checks after applying `migrations/031_corporate_catering_requests.sql` and deploying the corporate APIs/UI. Keep all results before enabling the Catering navigation for requesters.

## 1. Migration and privilege checks

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_corporate_catering_request', 'decide_corporate_approval');
```

Expected: both functions exist and execute is granted only to `service_role`. The anon/authenticated roles must not be able to call either RPC directly.

## 2. Authorization matrix

| Caller | Expected |
|---|---|
| `employee` on any `/corporate/...` endpoint | `403` |
| Requester reading another requester's `orderId` | `404 CORPORATE_ORDER_NOT_FOUND` |
| `vendor_staff` or `vendor_manager` on approval endpoints | `403` |
| Admin or finance on approval endpoints | allowed |
| Non-approver submitting `POST /corporate/approvals/{id}/decision` | `403` |

The same route guards apply to list and detail endpoints. Super admin remains allowed through the existing role middleware.

## 3. Request creation

Submit a request with two items and a future schedule. Confirm:

- `order_type = 'corporate'`, `status = 'submitted'`, `payment_status = 'succeeded'`, `payment_method = 'cost_centre'`.
- `order_items` retain names, unit prices, quantities, and line totals even if menu items are later changed or archived.
- `payments` has one internal row with `status = 'succeeded'` and amount equal to the order total.
- `corporate_orders.approval_status = 'pending'` and one approval step exists.
- `total = subtotal + service_fee`; the fee follows the active rule for the selected location/site.
- The requester-only list returns the request; another requester does not see it.

```sql
select o.order_reference, o.order_type, o.status, o.payment_status, o.payment_method,
       o.subtotal, o.service_fee, o.total,
       co.approval_status, c.requester_user_id
from public.orders o
join public.corporate_orders co on co.order_id = o.id
join public.corporate_attendees c on c.order_id = o.id
where o.order_reference = '{reference}';
```

## 4. Validation guard rails

Submit each invalid case and expect the matching error code:

- Delivery after meeting start → `INVALID_CORPORATE_SCHEDULE`.
- Meeting end before start → `INVALID_CORPORATE_SCHEDULE`.
- Duplicate menu item lines → `INVALID_CORPORATE_ITEMS`.
- Vendor without `corporate_catering_enabled` → `CORPORATE_VENDOR_UNAVAILABLE`.
- Location belonging to another vendor or inactive → `CORPORATE_LOCATION_NOT_FOUND`.
- Item from another vendor or unavailable → `CORPORATE_ITEM_UNAVAILABLE`.

No order, payment, item, or corporate row should be left behind after a rejected validation attempt.

## 5. Approval decisions

- Approve a pending request → `approvalStatus = approved`, order status `payment_confirmed`.
- Reject with a reason → `approvalStatus = rejected`, order status `rejected`, reason stored in `orders.rejection_reason`.
- Request amendment → `approvalStatus = amendment_requested`, order remains `submitted`.
- Re-submit any decision → `409 CORPORATE_ALREADY_DECIDED`.
- Reject without comments → `400 INVALID_APPROVAL_DECISION`.

Confirm one audit row per decision:

```sql
select actor_user_id, action, table_name, record_key, new_data, reason, category
from public.audit_logs
where table_name = 'public.corporate_orders'
order by created_at desc
limit 10;
```

`actor_user_id` must be the approver; `action` is `UPDATE`; `record_key` is the order id; `category` is `lifecycle`.

## 6. Pagination and UI smoke

- Create at least nine requests and verify `/corporate/requests` and `/corporate/approvals/pending` return stable server pages with unchanged totals.
- Eligible roles see **Catering** in the main navigation; `employee` does not.
- Direct `/corporate` access by an ineligible role redirects to `/`.
- Admin sees **Catering approvals** under Operations; the approval queue only shows pending items.
- Requester detail and approver detail show the same retained item snapshots and totals.
- No admin mock figures, vendors, or requests appear in either screen.

## 7. Concurrency

Open the same pending request in two approval sessions and decide in both. Exactly one decision must succeed; the other must return `409 CORPORATE_ALREADY_DECIDED` or `APPROVAL_STEP_NOT_PENDING`, and the audit log must contain only one decision row from an approver for that request.
