# Notification centre

The notification centre stores one row per dispatched event and channel in
`public.notifications`. Category, severity, title templates, default channels
and deep links live in the server-owned catalog at
`server/src/services/notificationCatalog.js`; request bodies never choose them.

## Migration

Apply the numbered migration before deploying the API:

```sql
-- from a transaction-capable SQL client (Supabase SQL editor, psql, etc.)
\i server/src/docs/migrations/034_notification_center.sql
```

`034_notification_center.sql` is idempotent: it adds `metadata jsonb not null
default '{}'::jsonb` and `dedupe_key text`, a partial unique index on
`(user_id, dedupe_key)`, an index on `(user_id, read_at, created_at desc)`, and
revokes `INSERT`/`DELETE` from `authenticated`. No table or existing row is
dropped or rewritten. The service role keeps full access because **the server
creates and deletes notification rows**; clients may only read their own rows
and mark them read through the API below.

## API

All endpoints require `Authorization: Bearer <access_token>`. The user id is
always `req.user.id`; query/body user ids are ignored.

| Method | Path | Purpose | Response |
| --- | --- | --- | --- |
| `GET` | `/api/v1/notifications?page=1&limit=20&filter=all\|unread\|read&eventKey=&orderId=` | Paginated inbox | `{ success, notifications, unreadCount, level, pagination }` |
| `GET` | `/api/v1/notifications/unread-count` | Bell state | `{ success, unreadCount, level }` |
| `PATCH` | `/api/v1/notifications/:notificationId/read` | Mark read (idempotent) | `{ success, notification }` |
| `PATCH` | `/api/v1/notifications/:notificationId/unread` | Mark unread (idempotent) | `{ success, notification }` |
| `DELETE` | `/api/v1/notifications/:notificationId` | Delete one owned row | `{ success }` |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all unread rows read | `{ success, updated }` |
| `DELETE` | `/api/v1/notifications/read` | Delete all read rows | `{ success, deleted }` |
| `GET` | `/api/v1/notification-preferences` | Read preference alias | `{ success, preferences }` |
| `PATCH` | `/api/v1/notification-preferences` | Update preference alias | `{ success, preferences }` |

`filter=unread` uses `read_at IS NULL`; `filter=read` uses `read_at IS NOT NULL`.
Mutations are scoped by both notification id and user id, and return
`404 NOTIFICATION_NOT_FOUND` for rows owned by another user. Responses are
always `Cache-Control: no-store`.

`GET notification-preferences` returns:

```json
{
  "success": true,
  "preferences": {
    "transactional": true,
    "order_updates": true,
    "promotions": false,
    "collection_reminders": true,
    "onboarding_completed": false
  }
}
```

`PATCH /notification-preferences` accepts a flat body (`{ "promotions": true }`)
or the canonical nested body (`{ "notification_preferences": { ... } }`). Both
are validated with `normalizeProfilePatch` and merged with
`mergeNotificationPreferences` into `profiles.notification_preferences`; there
is no second preference store. `transactional` and unknown keys are rejected.

## Event / preference matrix

| Event key | Category | Preference | Bell level | Channels |
| --- | --- | --- | --- | --- |
| `order.placed` | order | transactional | info | in_app, email |
| `order.payment_confirmed` | payment | transactional | info | in_app, email |
| `order.payment_failed` | payment | transactional | alert | in_app, email |
| `order.accepted` | order | order_updates | info | in_app, email |
| `order.preparing` | order | order_updates | info | in_app, email |
| `order.ready_for_collection` | order | order_updates | info | in_app, email |
| `order.collected` | order | order_updates | info | in_app |
| `order.cancelled` | order | transactional | alert | in_app, email |
| `order.refunded` | payment | transactional | alert | in_app, email |
| `corporate.approved` | order | transactional | info | in_app, email |
| `corporate.rejected` | order | transactional | alert | in_app, email |
| `cart.expiring` | cart | collection_reminders | warning | in_app, email |
| `cart.expired` | cart | collection_reminders | warning | in_app, email |
| `vendor.menu_updated` | vendor | order_updates | info | in_app |
| `vendor.unavailable` | vendor | order_updates | warning | in_app |
| `promotion.new_vendor` | promotion | promotions | warning | in_app, email |
| `account.password_changed` | account | transactional | alert | in_app, email |
| `system.update` | system | transactional | info | in_app |

Preference defaults: `order_updates !== false`, `promotions === true` (opt-in),
`collection_reminders !== false`, `transactional` always true. Unknown event
keys receive a transactional-safe `system` definition so a future emitter
cannot accidentally bypass gating.

The `collection_reminders` storage key is shown in Profile as **Cart reminders**:
“Remind me before my cart expires and when it is cleared”. Routine order
progress, including “Ready for collection”, remains under **Order updates**.

Bell level priority across unread rows: **alert** (payment failed, cancelled,
refunded, corporate rejection, password/security) > **warning** (promotions,
cart reminders, vendor availability) > **info** (any other unread row) >
**none**.

Cart reminders are the important gating change in this slice: both
`cart.expiring` and `cart.expired` now include the `email` channel. A profile
with `collection_reminders=false` suppresses **both** the in-app row and the
email before any sender is called. They no longer bypass preferences as direct
`sendEmail` calls did.

## Wired events

Every emission is wrapped in `try/catch`, logs with the `[Notification]` prefix
and never fails the business operation. Recipients come from the authenticated
user or the database order owner; request-body user ids and `to` addresses are
never used.

| Trigger | Event key(s) | Recipient source | Caller dedupe key |
| --- | --- | --- | --- |
| `orderController.createOrder` checkout RPC success | `order.placed` | `req.user.id` | `checkout` |
| `orderController.processMockPayment` changed outcome | `order.payment_confirmed`, `order.payment_failed`, `order.cancelled` | `req.user.id` | outcome (`succeeded`/`failed`/`cancelled`) |
| `orderController.cancelMyOrder` success | `order.refunded` (payment succeeded) or `order.cancelled` | `order.user_id` | `customer-cancel` |
| `vendorOperationsController.updateMyVendorOrderStatus` success | `order.accepted`, `order.preparing`, `order.ready_for_collection`, `order.collected`, `order.cancelled` (rejected) | `order.user_id` | `nextStatus` |
| `cartExpiry.js` one-time reminder / atomic expiry RPC | `cart.expiring`, `cart.expired` | `cart.user_id` | `cart.id` |
| `corporateController.decideCorporateApproval` approved/rejected RPC | `corporate.approved`, `corporate.rejected` | `corporate_orders.requester_user_id` | `corporate-decision` |
| Hardened `/email/order-confirmed` | `order.placed` | resolved `order.user_id` | `checkout` |
| Hardened `/email/order-ready` | `order.ready_for_collection` | resolved `order.user_id` | `ready_for_collection` |

The collection code is deliberately excluded from notification titles, bodies
and contexts. Checkout context only carries server-owned order reference,
vendor, collection slot time, item summaries, total and currency.

## Dispatch and dedupe

Emitters call:

```js
await dispatchNotification({
  userId,
  eventKey: 'order.ready_for_collection',
  orderId,
  context: { orderReference, vendorName },
  dedupeKey: 'ready-v1', // optional caller idempotency hint
});
```

The deterministic key is
`${eventKey}:${orderId ?? 'none'}:${dedupeKey ?? ''}:${channel}`. The in-app row
(channel `in_app`, status `sent`) is created first. A unique violation returns
the existing row and suppresses a second email for the same event. If the event
also has an `email` channel and the profile has an email address, the rendered
message is sent through the injected low-level sender and a separate `email`
row records `sent` or `failed` plus `failure_reason`. Email failures never fail
the caller's business operation.

Caller idempotency hints used today:

| Hint | Events | Scope |
| --- | --- | --- |
| `checkout` | `order.placed` | one placement notification per order |
| `succeeded` / `failed` / `cancelled` | payment outcome events | one changed mock-payment outcome per order |
| `customer-cancel` | `order.refunded`, `order.cancelled` | one customer cancellation per order |
| `accepted` / `preparing` / `ready_for_collection` / `collected` / `rejected` | vendor status events | one notification per status per order |
| `cart.id` | `cart.expiring`, `cart.expired` | one reminder and one expiry notice per cart |
| `corporate-decision` | `corporate.approved`, `corporate.rejected` | one decision notification per order |
| `ready_for_collection` | `order.ready_for_collection` (hardened email endpoint) | aligns the endpoint with the vendor status event |

## Rich email mapping

`dispatchNotification` now passes `eventKey`, `context` and `metadata` to the
email adapter in addition to `to`, `subject` and `html`. The default adapter is
`server/src/services/notificationEmail.js`; it keeps the service-supplied
subject and chooses an existing template:

| Event key(s) | Template | Notes |
| --- | --- | --- |
| `order.placed`, `order.payment_confirmed` | `email/templates/orderConfirmed.js` | Reads `orderReference`, `vendorName`, `collectionTime`, `items`, `total` from context. |
| `order.accepted`, `order.preparing` | `email/templates/orderStatus.js` | Shared progress layout with the same info rows and CTA as confirmation. |
| `order.ready_for_collection` | `email/templates/orderReady.js` | Reads `orderReference`, `vendorName`, `collectionPoint`/`collectionTime`. |
| `cart.expiring` | `email/templates/cartExpiringSoon.js` | Reads `vendorName`, `cartUrl`; unsafe URL schemes fall back to `/cart`. |
| `cart.expired` | `email/templates/cartExpired.js` | Reads `vendorName`, `cartUrl`; unsafe URL schemes fall back to `/cafeterias`. |
| All other events | Generic HTML built by `notificationService.js` | Includes the sanitized catalog action path. |

All order templates use `metadata.actionPath` for a real **View order** button;
root-relative paths are made absolute with `CLIENT_URL`. Missing context values
render as safe empty/default values and template errors fall back to the generic
HTML instead of throwing. User-owned values are escaped before interpolation and
are never appended to a URL. The low-level sender is injectable for tests.

Internal identifiers (`orderId`, `vendorId`, `cartId`), collection codes,
hashes and tokens are stripped from stored notification context and from the API
DTO. User-facing copy uses the human-readable order reference and vendor name
only. The action path remains an opaque internal route used by the CTA and is
never rendered as text.

`/email/order-confirmed` and `/email/order-ready` remain authenticated routes,
but now resolve the order by `order_reference`, require it to belong to
`req.user.id` (404 when missing, 403 when not owned) and dispatch to the stored
owner. Any client-supplied `to` is ignored. Other email routes (auth webhook,
welcome, vendor invitation, vendor decision) are unchanged.

## Future hooks (intentionally not wired in this slice)

- **Ratings** (`rateOrder`): there is no catalog event or agreed user-facing
  copy for "order rated." Add a dedicated `order.rated` event before wiring
  after the rating insert/audit.
- **Vendor menu updates**: menu edits go through several draft/publish
  endpoints without a single reliable "menu published" event. Wiring individual
  patches would notify followers about incomplete changes.
- **Promotions / new vendor**: there is no explicit promotion publish action
  tied to a vendor becoming newly available. A future admin action should
  dispatch `promotion.new_vendor` with a vendor id.
- **Password changes**: Supabase auth currently owns the password-reset email
  hook. An authenticated "change password" server callback is needed before
  dispatching `account.password_changed` in-app and by email.

## Realtime

Supabase Realtime is **not yet configured** for this slice. Clients should
poll `GET /notifications/unread-count` (or refetch `/notifications`) after
relevant actions and on focus/visibility changes. No socket channel or
subscription contract should be assumed yet.

## Tests

From `server/`:

```bash
node --test "tests/**/*.test.js"
```
