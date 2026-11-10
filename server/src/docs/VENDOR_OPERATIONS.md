# Vendor operations API

## Menu management

Vendor menu editing is available to authenticated users with an active `vendor_users` membership. Reading categories is available to vendor staff and managers; creating, editing, and archiving menu items requires the membership role `manager`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/vendor/menu?vendor_id={id}` | Read the selected vendor location’s published menu for today |
| `GET` | `/vendor/menu/categories?vendor_id={id}` | Read categories for the vendor |
| `POST` | `/vendor/menu/items` | Create an item on the selected published menu |
| `PATCH` | `/vendor/menu/items/{itemId}` | Update item details |
| `DELETE` | `/vendor/menu/items/{itemId}` | Archive an item (soft deactivation) |
| `PATCH` | `/vendor/menu/items/{itemId}/availability` | Change item availability on today’s menu |

Create requests include `vendor_id`, `menu_id`, `name`, and `base_price`. The API verifies the manager membership, vendor ownership of the category and menu, active location, published menu status, and current Johannesburg date. Amounts must be non-negative with no more than two decimal places. Ingredients are stored as up to 50 text values.

Archiving sets `is_active=false` and `status=unavailable`. It does not physically delete the row, so historical order items keep their foreign-key references and snapshots.

The editor currently supports name, description, category, price, preparation estimate, portion, ingredients, and availability. Vendor image uploads, dietary/allergen editing, option groups, and weekly menu scheduling are not part of this API slice yet.

## Vendor invitations

Admins can invite an email address to one approved vendor as `staff` or `manager`. The invitation does not assign a platform-wide role. The recipient must sign in or register with the invited address, verify that email, and redeem the single-use token. Redemption is atomic with creating or updating the `vendor_users` membership. Expiry is the end of the third working day in `Africa/Johannesburg`; Saturdays, Sundays, and South African public holidays do not count.

The invitation token is generated with 256 bits of randomness. Only its SHA-256 hash is stored. Pending invitations can be revoked, and issuing a replacement revokes earlier pending invitations for the same vendor and email. Expired, revoked, wrong-email, and previously accepted tokens cannot be redeemed.

## Database migrations

Apply `migrations/019_vendor_invitations.sql` before enabling the admin invitation action. It creates the invitation table and service-role-only RPCs used for serialized creation and transactional redemption.

No migration is required for vendor menu CRUD. The existing schema already provides `menu_items`, `menu_categories`, and the `menu_menu_items` relationship, including audit triggers.

## Authorization and audit

Every vendor operations route requires authentication and verifies active vendor membership. Order processing and availability updates are available to active staff and managers; menu item creation, detail edits, and archiving additionally require the manager membership role. Order status transitions are validated server-side, rejection reasons are required and capped at 500 characters, and collection completion requires the order's matching four-character code. Mutations write application audit entries. Invitation creation and redemption record explicit actor-attributed audit entries.
