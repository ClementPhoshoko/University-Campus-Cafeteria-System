# Corporate catering — verification runbook

Apply migrations `031`, `034`–`040` in order and deploy the matching API/UI
before running these checks. Every result below comes from real rows and real
API responses; no mock data is used.

## 1. Migrations and privileges

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_corporate_catering_request', 'decide_corporate_approval',
    'create_corporate_quote', 'submit_corporate_quote', 'withdraw_corporate_quote',
    'accept_corporate_quote', 'reject_corporate_quote',
    'request_corporate_reapproval', 'dispatch_corporate_order',
    'mark_corporate_delivered', 'confirm_corporate_delivery'
  )
order by routine_name;
```

Expected: all functions exist. `grantee = 'service_role'` has `EXECUTE`;
`anon` and `authenticated` do not. `corporate_orders` has
`accepted_quote_id` and `quoted_total`. `private.is_catering_requester()`
exists.

```sql
select p.proname, r.rolname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_proc_acl a on a.objid = p.oid
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and p.proname in ('create_corporate_quote', 'dispatch_corporate_order', 'confirm_corporate_delivery');
```

## 2. Role consolidation

- Admin user role writes accept only `employee`, `catering_requester`, `admin`,
  `finance`, `support`, and `auditor`.
- `vendor_staff` and `vendor_manager` are rejected from `user_roles` writes and
  derive only from active `vendor_users`.
- Existing users with legacy requester roles were backfilled into
  `catering_requester`; legacy rows may remain but are labelled legacy in
  Profile → Access.
- `catering_requester` can use the Catering page. `employee` cannot.
- `cost_centre_owner` alone cannot approve: the RPC requires `admin` or
  `finance`.

## 3. Authorization matrix

| Caller | Expected |
| --- | --- |
| `employee` on any `/corporate/...` endpoint | `403` |
| Requester reading another requester's `orderId` | `404 CORPORATE_ORDER_NOT_FOUND` |
| Vendor staff on `/vendor/corporate/...` | `403 VENDOR_MANAGER_REQUIRED` |
| Vendor manager on another vendor's `vendor_id` | `403 VENDOR_ACCESS_DENIED` |
| Admin/finance on approval endpoints and `/corporate/report` | allowed |
| Requester on approval endpoints or `/corporate/report` | `403` |

A vendor manager can read and mutate only their own vendor's corporate
requests. Requesters cannot accept another requester's quote or confirm another
request's delivery.

## 4. Request creation and first approval

Submit a request with two items and a future schedule. Confirm:

- `orders.order_type = 'corporate'`, `status = 'submitted'`,
  `payment_status = 'succeeded'`, `payment_method = 'cost_centre'`.
- `order_items` retain names, unit prices, quantities, and line totals.
- `payments` has one internal succeeded row equal to the order total.
- `corporate_orders.approval_status = 'pending'` and one sequence `1` approval
  step exists.
- Invalid schedules, duplicate items, disabled vendors/locations/items, and
  missing cost centres return the documented `4xx` code and leave no rows.

Approve the request:

- `approval_status = approved`, order status `payment_confirmed`.
- The requester receives one `corporate.approved` notification row and email.
- Re-submitting returns `409 CORPORATE_ALREADY_DECIDED`.

## 5. Quote and acceptance

As a vendor manager, save a draft quote then submit it:

- Only one draft exists per order; a second submitted quote returns
  `CORPORATE_QUOTE_EXISTS`.
- Subtotal, fee, and tax are rounded to cents; the total is their sum.
- The requester receives `corporate.quote_submitted`.
- Declining with a reason marks it `rejected`, notifies vendor managers, and
  allows a revised quote.
- Withdrawing a submitted quote marks it `expired`.

Accept a quote:

- If `quote.total <= order.total`, `approval_status` stays `approved`, the
  quote is `accepted`, and vendor managers receive `corporate.quote_accepted`.
- If `quote.total > order.total`, approval sequence `2` becomes `pending`,
  `approval_status = pending`, `quoted_total = quote.total`, and approvers
  receive `corporate.reapproval_required`.
- The manager can dispatch only after sequence `2` is approved.

## 6. Re-approval

- The approver queue shows a **Quote re-approval** badge and the accepted quote
  total.
- Approving sequence `2` applies `quote.subtotal`, `service_fee`, `tax`, and
  `total` to the order, updates the succeeded payment amount, and leaves the
  order in `payment_confirmed`.
- Rejecting sequence `2` rejects the order and records the reason.
- A requester can also call `/corporate/requests/{id}/reapproval` with a reason
  for an already accepted quote; it reopens sequence `2`.
- Each decision writes one `public.corporate_orders` audit row with the
  approver as `actor_user_id`.

## 7. Dispatch, delivery, confirmation

1. With an accepted quote and an approved request, dispatch with courier name.
   The delivery status becomes `delivery_in_progress`, the order moves from
   `payment_confirmed` or `preparing` to `delivery_in_progress`, and the
   requester receives `corporate.dispatched`.
2. Mark delivered. The delivery and order both become `delivered`; the requester
   receives `corporate.delivered`.
3. Confirm delivery. The delivery becomes `completed`,
   `recipient_confirmed_at` and `recipient_user_id` are set, the order becomes
   `completed`, and vendor managers receive `corporate.delivery_confirmed`.
4. Replaying any step returns the matching `409` code; no duplicate audit or
   notification row is created for the same dedupe key.

Audit check:

```sql
select actor_user_id, action, table_name, record_key, category
from public.audit_logs
where table_name in ('public.corporate_quotes', 'public.corporate_deliveries', 'public.corporate_orders')
order by created_at desc
limit 50;
```

## 8. Report and UI smoke

- Admin → Reports → Corporate shows live orders, revenue, top cost centres,
  vendor revenue, and upcoming events from `/corporate/report`.
- Requesters see quotes and delivery status on their Catering page and can act
  only on their own requests.
- Admin and finance see `/finance` or `/admin/corporate-approvals`; other roles
  are redirected.
- Vendor managers see the **Catering** item in the workspace sidebar; vendor
  staff do not, and direct `?view=catering` redirects to `/vendor`.
- No client inserts notification rows. Notification writes use the service
  role through `dispatchNotification`.

## 9. Automated suite

From `server/`:

```bash
npm test
```

From `client/`:

```bash
node --test "src/**/*.test.js"
npm run build
```

A production build and both suites must pass with no `git diff --check` errors.
