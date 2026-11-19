# Corporate catering foundation

The corporate catering foundation turns an empty product area into a real, auditable request flow. It intentionally stops before vendor quote/accept/dispatch actions, because those transitions need separate product rules.

## Deployment

Apply `migrations/031_corporate_catering_requests.sql` from the Supabase migration role before deploying the corporate APIs. The migration only adds indexes and two service-role-only `SECURITY DEFINER` RPCs; it does not drop or rewrite existing tables.

## Product rules

- **Requesters:** executive, executive assistant, meeting organiser, training coordinator, and cost centre owner.
- **Approvers:** admin or finance. Approval confirms the cost-centre charge; there is no employee card step.
- **Pricing:** menu prices are snapshotted into `order_items` at submission. The service fee is calculated with the existing fee rules (default 5%) and stored on the order.
- **Payment:** an internal `cost_centre` payment row is written with status `succeeded` in the same transaction as the request.
- **Visibility:** requesters see only requests they submitted or that were created on their behalf. Approvers see pending requests and can read any request detail for review.

## API

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/corporate/requests` | Requester role | Create a pending corporate request |
| `GET` | `/corporate/requests` | Requester role | Server-paginated list of own requests |
| `GET` | `/corporate/requests/{orderId}` | Requester role | Own request detail |
| `GET` | `/corporate/approvals/pending` | Admin or finance | Server-paginated pending queue |
| `GET` | `/corporate/approvals/{orderId}` | Admin or finance | Review detail for any request |
| `POST` | `/corporate/approvals/{orderId}/decision` | Admin or finance | Approve, reject, or request amendment |

Rejections and amendment requests require comments. Duplicate decisions and stale approval steps return `409`.

## Lifecycle

1. `create_corporate_catering_request` validates schedule, attendees, vendor availability, location ownership, item availability, totals, and on-behalf-of user.
2. It inserts the order as `payment_pending`, writes the internal payment snapshot, then moves the order to `submitted`.
3. It inserts retained order items, the `corporate_orders` row, one pending approval step, and an attributed `INSERT` audit row.
4. `decide_corporate_approval` locks the corporate row and pending step before changing them.
5. `approved` moves the order to `payment_confirmed`. `rejected` moves it to `rejected` with the reason. `amendment_requested` leaves the order submitted. Each decision writes an attributed `UPDATE` audit row.

Vendor quoting, acceptance, dispatch, delivery confirmation, and their audit events are deliberately not implemented in this slice. The existing `corporate_quotes` and `corporate_deliveries` tables are read-only in request detail until those rules are agreed.

## UI

- **Catering** page (`/corporate`) lets eligible employees choose an approved catering vendor, active location, menu items, schedule, venue, cost centre, and requirements. It lists their requests with server pagination and request detail.
- **Admin → Catering approvals** (`/admin/corporate-approvals`) lists pending requests with server pagination and lets an approver review details and record a decision.
- The admin navigation adds **Catering approvals** to the Operations group. The employee navigation now shows **Catering** to the five requester roles.

No admin mock data is used. All request figures and statuses come from the corporate API reading real database rows.
