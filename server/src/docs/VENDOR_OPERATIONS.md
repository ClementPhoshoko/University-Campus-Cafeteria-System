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

## Database migration

No migration is required for vendor menu CRUD. The existing schema already provides `menu_items`, `menu_categories`, and the `menu_menu_items` relationship, including audit triggers. The endpoint uses these existing structures and the existing audit writer. Add a migration only when a later feature introduces a schema change, such as inventory reservation rules.

## Authorization and audit

Every route requires authentication and verifies active vendor membership. Menu item mutations additionally require the manager role and are rate-limited. Mutations write application audit entries. The existing database audit trigger also records row changes.
