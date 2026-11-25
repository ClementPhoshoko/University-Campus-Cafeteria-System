# Corporate catering

Corporate catering is a real, server-authoritative flow: a requester submits a
cost-centre order, an admin or finance approver confirms the charge, a vendor
manager quotes and delivers it, and the requester confirms receipt. Every state
change runs through a service-role-only RPC and writes an attributed audit row.

## Deployment

Apply the numbered migrations in order before deploying the dependent API/UI:

1. `migrations/031_corporate_catering_requests.sql` — request creation and first
   approval step.
2. `migrations/034_notification_center.sql`,
   `035_notification_inbox_realtime.sql`, and
   `036_notification_dedupe_canonical.sql` — server-owned notification rows.
3. `migrations/037_vendor_roles_derived_only.sql` — vendor roles derive only
   from active `vendor_users` rows.
4. `migrations/038_corporate_requester_role_consolidation.sql` — adds
   `catering_requester`, backfills legacy requester roles, and keeps legacy rows
   readable.
5. `migrations/039_corporate_vendor_quotes.sql` — quote RPCs, accepted quote
   totals, approval sequence `2`, and audits.
6. `migrations/040_corporate_delivery_workflow.sql` — corporate-only dispatch,
   delivery, confirmation transitions, and RPCs.

Migrations are additive/idempotent where practical. No legacy table or role row
is deleted.

## Roles

- **Requester:** `catering_requester` is the only assignable requester role.
  `executive`, `executive_assistant`, `meeting_organiser`,
  `training_coordinator`, and `cost_centre_owner` remain readable for existing
  users but are deprecated and not granted by the UI/API.
- **Approvers:** `admin` and `finance` only. A cost centre owner never approves.
- **Vendor manager:** active `vendor_users.role = 'manager'`. Creates/submits or
  withdraws quotes, dispatches, and marks delivered.
- **Vendor staff:** active `vendor_users.role = 'staff'`. Cannot quote, approve,
  dispatch, or enter the vendor Catering workspace.
- Vendor roles are never written to `user_roles`.

## Lifecycle

1. `create_corporate_catering_request` validates the vendor, location, schedule,
   attendees, and item snapshots. It inserts an `order_type = 'corporate'` order
   with a succeeded internal `cost_centre` payment, retained `order_items`, the
   `corporate_orders` row, one pending approval step, and an audit row.
2. First approval (`sequence_no = 1`) sets `approval_status = approved` and the
   order status to `payment_confirmed`. Rejection/amendment requires comments.
3. A vendor manager saves a draft quote and submits it. The requester is
   notified by the server and can accept or decline it.
4. Accepting a quote records `accepted_quote_id` and `quoted_total`. If the quote
   total is above the originally approved total, approval sequence `2` becomes
   pending; the quoted totals are applied to the order and payment only when an
   approver approves that step. The requester can also request re-approval
   manually with a reason.
5. Dispatch requires an approved request, an accepted quote, and an order in
   `payment_confirmed` or `preparing`. It records courier details and moves the
   order to `delivery_in_progress`.
6. The vendor marks the order `delivered`; the requester confirms receipt,
   optionally reporting missing or incorrect items. Confirmation completes both
   the delivery and the order.

`preparing → delivery_in_progress`, `delivery_in_progress → delivered`, and
`delivered → completed` are allowed only for corporate orders.

## API

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/corporate/requests` | Requester | Create a pending cost-centre request |
| `GET` | `/corporate/requests` | Requester | Server-paginated own requests |
| `GET` | `/corporate/requests/{orderId}` | Requester | Own request detail |
| `POST` | `/corporate/quotes/{quoteId}/accept` | Requester | Accept a submitted quote |
| `POST` | `/corporate/quotes/{quoteId}/reject` | Requester | Decline a submitted quote with a reason |
| `POST` | `/corporate/requests/{orderId}/reapproval` | Requester | Request sequence `2` re-approval |
| `POST` | `/corporate/requests/{orderId}/confirm-delivery` | Requester | Confirm delivery |
| `GET` | `/corporate/approvals/pending` | Admin or finance | Pending approval queue |
| `GET` | `/corporate/approvals/{orderId}` | Admin or finance | Any request review detail |
| `POST` | `/corporate/approvals/{orderId}/decision` | Admin or finance | Approve/reject/amend current step |
| `GET` | `/corporate/report` | Admin or finance | Live corporate report |
| `GET` | `/vendor/corporate` | Vendor manager | Vendor's server-paginated requests |
| `GET` | `/vendor/corporate/{orderId}` | Vendor manager | Request detail |
| `POST` | `/vendor/corporate/{orderId}/quote` | Vendor manager | Save draft quote |
| `POST` | `/vendor/corporate/quotes/{quoteId}/submit` | Vendor manager | Submit quote |
| `POST` | `/vendor/corporate/quotes/{quoteId}/withdraw` | Vendor manager | Withdraw submitted quote |
| `POST` | `/vendor/corporate/{orderId}/dispatch` | Vendor manager | Dispatch accepted order |
| `POST` | `/vendor/corporate/{orderId}/delivered` | Vendor manager | Mark delivered |

All responses are authenticated, user/vendor-scoped, and `private, no-store`.
Clients never insert notification rows; the server dispatches them via the
service role.

## Notifications

The server emits `corporate.quote_submitted`, `corporate.quote_accepted`,
`corporate.quote_rejected`, `corporate.reapproval_required`,
`corporate.dispatched`, `corporate.delivered`, and
`corporate.delivery_confirmed`, alongside the original approval events.
Recipients and context come from database rows only. Notification failures are
logged and never fail the business action.

## UI

- **Catering** (`/corporate`) — requester creation, status tracking, quote
  review/accept/decline, re-approval badge and request, dispatch/delivery
  timeline, and delivery confirmation.
- **Catering approvals** (`/admin/corporate-approvals`, `/finance`) — admin and
  finance review pending requests, including sequence `2` quote re-approval.
- **Vendor → Catering** (`/vendor/catering`) — manager-only quote, dispatch, and
  delivery workspace. It is not shown to vendor staff.
- **Admin → Reports → Corporate** — live data from `/corporate/report`; the old
  corporate mock object is no longer used.

Cost centres remain free text. Tax and invoicing rules are deferred.
