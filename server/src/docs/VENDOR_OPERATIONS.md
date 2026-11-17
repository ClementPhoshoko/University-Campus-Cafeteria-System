# Vendor operations API

## Menu management

The daily vendor workspace remains focused on the first active location’s published menu and order queue. Order and menu lists return server-paginated rows with totals. Orders accept `filter=active`, `filter=needs_attention`, or `filter=ready_for_collection`, default to five rows, and cap pages at 50. Queue order is collection start time, then order creation time and ID. The order endpoint also returns queue counts and the next collection summary. Staff and managers can update availability for items on today’s published menu. Managers can maintain the reusable catalogue and categories. Dated and recurring menu planning are not part of this scope.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vendor/menu?vendor_id={id}&page={n}&limit={n}` | Read one page of the selected vendor location’s published menu for today |
| `GET` | `/vendor/menu/categories?vendor_id={id}&page={n}&limit={n}` | Read one page of active vendor categories |
| `POST` | `/vendor/menu/categories` | Create a category for the manager’s vendor |
| `PATCH` | `/vendor/menu/categories/{categoryId}` | Rename or archive a category owned by the manager’s vendor |
| `POST` | `/vendor/menu/catalog-items` | Create a reusable catalogue item (manager only) |
| `POST` | `/vendor/menu/items` | Create an item and attach it to today’s published menu |
| `POST` | `/vendor/menu/items/{itemId}/image` | Upload or replace a menu item image (manager only) |
| `PATCH` | `/vendor/menu/items/{itemId}` | Update item details |
| `DELETE` | `/vendor/menu/items/{itemId}` | Archive an item (soft deactivation) |
| `PATCH` | `/vendor/menu/items/{itemId}/availability` | Change item availability on today’s menu |

The reusable catalogue is separate from the daily published menu. The `/vendor/menus` client path is a compatibility redirect to catalogue management, not a dated-menu API. Staff availability updates apply only to items linked to today’s published menu at the first active vendor location.

The legacy create request includes `vendor_id`, `menu_id`, `name`, and `base_price`, and attaches the item to today’s published menu. All item prices must be non-negative with no more than two decimal places. Ingredients are stored as up to 50 text values.

Archiving sets `is_active=false` and `status=unavailable`. It does not physically delete the row, so historical order items keep their foreign-key references and snapshots.

The catalogue editor supports name, description, category, price, preparation estimate, portion, ingredients, default availability, and an item image. Image uploads are restricted to active managers of the vendor that owns the item. Dietary/allergen editing, option groups, recurring weekly templates, and quantity-based stock are not part of this API slice yet.

## Vendor invitations

Admins can invite an email address to one approved vendor as `staff` or `manager`. Active vendor managers can also invite staff to their own vendor; the API fixes the role to `staff` regardless of request data, and managers cannot invite or change manager access. The invitation does not assign a platform-wide role. The high-entropy, single-use link delivered to the invited mailbox serves as email verification. For a new account, the server creates it with its email confirmed, atomically redeems the invitation, and assigns the vendor membership; it does not send a separate signup-verification email. Existing account holders sign in with the invited address and accept; if their account is still unverified, presenting the valid invitation link confirms that email without changing their password. A joined-team confirmation email is sent after successful acceptance.

The public registration endpoint accepts only the invitation token, full name, and password. It derives the email, vendor, and role from the stored invitation; it never trusts those values from the client. Expiry, revocation, email matching, vendor approval, and single-use redemption are enforced server-side. Expiry is the end of the third working day in `Africa/Johannesburg`; Saturdays, Sundays, and South African public holidays do not count.

The invitation token is generated with 256 bits of randomness. Only its SHA-256 hash is stored. Pending invitations can be revoked, and issuing a replacement revokes earlier pending invitations for the same vendor and email. Expired, revoked, wrong-email, and previously accepted tokens cannot be redeemed.

Vendor managers can list, issue, and revoke only staff invitations for their own vendor:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vendor/invitations?vendor_id={id}&page={n}&limit={n}` | List one page of staff invitations (manager only) |
| `POST` | `/vendor/invitations` | Invite an email as staff; `vendor_id` and `email` are accepted, role is server-set |
| `DELETE` | `/vendor/invitations/{invitationId}` | Revoke a pending staff invitation (manager only) |

Admins retain the existing ability to invite either staff or managers. A staff invitation cannot demote an existing manager, including if their membership changes while the invitation is pending.

## Manager staff access

Active vendor managers can view and remove staff access for their own vendor. Manager memberships remain administrator-controlled. Removing a staff member deactivates their `vendor_users` membership, revokes any pending staff invitation for the same vendor and email, and writes an actor-attributed audit entry in one database transaction.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vendor/staff?vendor_id={id}&page={n}&limit={n}` | List one page of active staff for the manager's vendor |
| `DELETE` | `/vendor/staff/{userId}?vendor_id={id}` | Deactivate a staff membership and revoke its pending invitations |

## Database migrations

Apply `migrations/019_vendor_invitations.sql` and `migrations/020_confirm_invited_auth_email.sql` before enabling the admin invitation action. They create the invitation table, service-role-only RPCs for serialized creation and transactional redemption, and a constrained lookup used to confirm an existing account's email only when its owner presents a valid invitation link.

Apply `migrations/021_vendor_menu_planning.sql` before enabling per-item availability on today’s published menu. It adds per-menu-item availability to `menu_menu_items` and initializes existing links from catalogue availability.

Apply `migrations/022_protect_vendor_manager_from_staff_invite.sql` before enabling manager invitations. It adds the atomic manager-only, staff-only invitation RPC and prevents staff invitations from changing an existing manager membership.

Apply `migrations/023_vendor_manager_staff_roster.sql` before enabling manager staff removal. It adds an atomic manager-scoped deactivation RPC that rejects manager targets, revokes matching pending staff invitations, and records audit entries.

Apply `migrations/024_vendor_order_queue_pagination.sql` before deploying server-side order queue pagination. It adds the queue index and service-role-only function that filters, counts, orders, and pages active vendor orders in the database.

## Authorization and audit

Every vendor operations route requires authentication and verifies active vendor membership. Order processing and daily availability updates are available to active staff and managers; menu planning, catalogue creation, item detail edits, and archiving additionally require the manager membership role. Order status transitions are validated server-side, rejection reasons are required and capped at 500 characters, and collection completion requires the order's matching four-character code. Mutations write application audit entries. Invitation creation and redemption record explicit actor-attributed audit entries.
