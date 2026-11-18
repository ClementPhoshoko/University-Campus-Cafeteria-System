# Vendor operations API

## Menu management

The vendor workspace shows the active catalogue and the order queue. Order and menu-item lists return server-paginated rows with totals. Orders accept `filter=active`, `filter=needs_attention`, or `filter=ready_for_collection`, default to five rows, and cap pages at 50. Queue order is collection start time, then order creation time and ID. The order endpoint also returns queue counts and the next collection summary. Staff and managers can update catalogue availability; managers can create, edit, and archive catalogue items and manage categories. Customer menus and cart validation use active catalogue items whose status is `available` or `limited`. Dated menu tables remain in the database for retained data, but do not gate current ordering.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vendor/menu?vendor_id={id}&page={n}&limit={n}` | Read one page of active catalogue items |
| `GET` | `/vendor/menu/categories?vendor_id={id}&page={n}&limit={n}` | Read one page of active vendor categories |
| `POST` | `/vendor/menu/categories` | Create a category for the manager’s vendor |
| `PATCH` | `/vendor/menu/categories/{categoryId}` | Rename or archive a category owned by the manager’s vendor |
| `POST` | `/vendor/menu/catalog-items` | Create a catalogue item (manager only) |
| `POST` | `/vendor/menu/items` | Compatibility route that creates a catalogue item (manager only) |
| `POST` | `/vendor/menu/items/{itemId}/image` | Upload or replace a menu item image (manager only) |
| `PATCH` | `/vendor/menu/items/{itemId}` | Update item details |
| `DELETE` | `/vendor/menu/items/{itemId}` | Archive an item (soft deactivation) |
| `PATCH` | `/vendor/menu/items/{itemId}/availability` | Change catalogue item availability |

The catalogue is the source of truth for item details and availability. `menu_items.status` is shared across a vendor's locations: `available` and `limited` items can be ordered; `sold_out` and `unavailable` items cannot. The `/vendor/menus` client path remains a compatibility redirect to catalogue management. New item requests require `vendor_id`, `name`, and `base_price`; `menu_id` is not required or used. All item prices must be non-negative with no more than two decimal places. Ingredients are stored as up to 50 text values.

Customer browsing requires an explicit `location_id` on vendor menu and item-detail requests. The client uses the employee's preferred building/site only when it resolves to exactly one active vendor location; otherwise the employee selects a pickup location. Adding a cart item requires `vendorLocationId`, which the server verifies belongs to the item's vendor and is active. Carts remain distinct per vendor location; cart slots come from that stored location, and checkout checks the selected location against both the active cart and collection slot.

Archiving sets `is_active=false` and `status=unavailable`. It does not physically delete the row, so historical order items keep their foreign-key references and snapshots.

The catalogue editor supports name, description, category, price, preparation estimate, portion, ingredients, default availability, and an item image. Image uploads are restricted to active managers of the vendor that owns the item. Managers can also assign shared dietary tags and allergens, add customer notices, and manage reusable vendor-owned option groups. Dietary/allergen names and notices are copied into order item snapshots at checkout, so later catalogue edits do not change order history. Recurring weekly templates and quantity-based stock are not part of this API slice yet.

### Catalogue dietary details and options

Apply migrations `026_vendor_catalogue_details.sql`, `027_admin_catalogue_metadata.sql`, and `028_vendor_item_configuration_sections.sql` in order. For an existing deployment, apply whichever numbered migrations have not already been run. Registry entries remain centrally managed; vendors can assign active shared dietary/allergen rows but cannot create or rename labels. Option groups and choices are vendor-owned. Configuration writes run through service-role-only database functions that re-check manager membership, item/group ownership, active registry values, and selection limits inside the database transaction, and write actor-attributed audit rows. The item-details modal loads Dietary, Allergens, and Customer options on demand; section saves leave the other sections untouched.

Apply `migrations/027_admin_catalogue_metadata.sql` to seed the shared dietary and allergen registries. Admins manage these entries from `/admin/catalogue-metadata`; create and edit labels there, and deactivate labels instead of deleting them. Inactive labels are excluded from new vendor assignments while existing item/order references are retained. Dietary and allergen choices are platform-wide, not vendor-specific. The starter allergens are based on common categories named in South Africa’s [R146 food-labelling regulations](https://www.health.gov.za/wp-content/uploads/2025/07/Labelling-Regulations-R146-of-1-March-2010.pdf); this registry is a vendor reference, not a compliance checklist. Vendors remain responsible for accurate ingredient and cross-contact information, and allergen notices should identify specifics where needed.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/catalogue-metadata` | List active and inactive shared dietary tags and allergens (admin only) |
| `POST` | `/admin/catalogue-metadata` | Create a shared label with `type` set to `dietary_tag` or `allergen` (admin only) |
| `PATCH` | `/admin/catalogue-metadata/{type}/{id}` | Edit or activate/deactivate a shared label (admin only) |

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vendor/menu/metadata-options?vendor_id={id}&type={dietary_tag\|allergen}` | List active shared dietary tags or allergens for the open section; omit `type` for both (manager only) |
| `GET` | `/vendor/menu/option-groups?vendor_id={id}&page={n}&limit={n}` | List one page of active option groups and choices (manager only) |
| `POST` | `/vendor/menu/option-groups` | Create a reusable group and its choices (manager only) |
| `PATCH` | `/vendor/menu/option-groups/{groupId}` | Update or archive a group and its choices (manager only) |
| `GET` | `/vendor/menu/items/{itemId}/configuration?section={dietary\|allergens\|options}` | Read only the selected section; omit `section` for all configuration (manager only) |
| `PUT` | `/vendor/menu/items/{itemId}/configuration` | Send a `section` plus its fields to update only that section transactionally; omit `section` for legacy all-section updates (manager only) |

Option groups have a vendor-unique name, selection type (`single` or `multiple`), required flag, and selection bounds. Each active choice has a non-negative price delta and maximum quantity. Removed choices are deactivated instead of deleted, preserving historical order/cart references. Archiving a group removes it from active customer selection while retaining its assignment and records. Checkout snapshots the active dietary labels, allergen names/notices, and selected option names/prices on each order item.

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

`migrations/021_vendor_menu_planning.sql` added per-menu availability for the earlier daily-menu flow. Keep the migration and its data; the current live flow no longer reads or writes that status.

Apply `migrations/022_protect_vendor_manager_from_staff_invite.sql` before enabling manager invitations. It adds the atomic manager-only, staff-only invitation RPC and prevents staff invitations from changing an existing manager membership.

Apply `migrations/023_vendor_manager_staff_roster.sql` before enabling manager staff removal. It adds an atomic manager-scoped deactivation RPC that rejects manager targets, revokes matching pending staff invitations, and records audit entries.

Apply `migrations/024_vendor_order_queue_pagination.sql` before deploying server-side order queue pagination. It adds the queue index and service-role-only function that filters, counts, orders, and pages active vendor orders in the database.

Apply `migrations/025_catalogue_availability_source_of_truth.sql` before deploying catalogue-based availability. It copies today's published status for each item at the vendor's first active location into `menu_items.status`; items without a matching menu link retain their current catalogue status. It does not delete dated menus or links.

Apply `migrations/026_vendor_catalogue_details.sql` before deploying manager dietary/allergen assignment, option-group management, and dietary/allergen order snapshots. It adds service-role-only transactional RPCs for vendor-manager-scoped writes; no tables or existing menu/order columns are removed.

## Authorization and audit

Every vendor operations route requires authentication and verifies active vendor membership. Order processing and catalogue availability updates are available to active staff and managers; catalogue creation, item detail edits, and archiving additionally require the manager membership role. Order status transitions are validated server-side, rejection reasons are required and capped at 500 characters, and collection completion requires the order's matching four-character code. Mutations write application audit entries. Invitation creation and redemption record explicit actor-attributed audit entries.
