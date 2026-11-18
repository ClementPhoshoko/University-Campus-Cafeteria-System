# Vendor Portal Roadmap

## Product and data rules

- The reusable `menu_items` catalogue is the source of truth for item details and global ordering status. `available` and `limited` can be ordered; `sold_out` and `unavailable` cannot.
- Daily menus remain stored as legacy/planning data. Do not require a published daily menu for customer browsing, vendor availability changes, or cart validation. Keep the existing `/vendor/menus` alias and migrations 019–025; do not delete or roll them back.
- Catalogue status is vendor-wide. Physical stock and collection capacity are location-specific. Customer menu, cart, checkout, stock, and pickup selection must resolve to the same authorized vendor location.
- Managers may manage catalogue configuration and their own vendor's staff. Staff may process orders and update item availability. Only admins may assign, change, or remove manager access.
- Use the existing `menu_categories`, dietary/allergen registries and joins, `option_groups`, `options`, and `menu_item_option_groups` where their current constraints fit. Never let vendor input assign records belonging to another vendor.

## Current foundation

- The role-aware vendor workspace is implemented. Staff and managers have the Overview; managers also have Menu & categories and Team access.
- The vendor order queue, catalogue item list, categories, staff roster, and invitations are server-paginated.
- Managers can create/edit/archive catalogue items and categories, invite staff, and remove staff. Staff can update catalogue status. Mutations are vendor-scoped and audited.
- Customer menu detail already reads dietary tags, allergens, and configured option groups. The item page supports option selection; cart validation and `cart_item_options` persist selections.
- Vendor managers now have scoped APIs and UI for assigning dietary tags/allergens, notices, and reusable vendor option groups. Checkout snapshots dietary/allergen details alongside existing option snapshots; migration 026 adds transactional, audited write functions and has been applied. API behavior still needs environment verification.
- Customer menu browsing and item detail now carry an explicit active vendor location, resolved from the employee's preferred site/building only when it identifies one location or chosen directly. Cart creation validates and stores that location; slot listing and checkout use the cart's same location.
- `menu_item_inventory` is currently keyed by `menu_id`; there is no live inventory reservation or release logic. It cannot serve as the new location-based stock model without a deliberate migration.
- Admin tools can pause/resume generated collection slots. Vendor-scoped slot controls do not exist. Vendor catering and reporting endpoints do not exist; current admin reports use mock data.

## Implementation roadmap

### 0. Vendor workspace and operations — complete

- [x] Keep navigation role-aware and restrict manager views server-side.
- [x] Provide paginated order, catalogue, category, staff, and invitation lists.
- [x] Support manager catalogue/category maintenance and team access management.
- [x] Use catalogue status for customer visibility, cart validation, and vendor availability.
- [x] Preserve existing daily-menu tables and add migration 025 to carry current availability into the catalogue before deployment.

### 1. Catalogue details and order snapshots — implementation complete; environment verification pending

**Backend and authorization**

- [x] Add manager-only, vendor-scoped read/write handlers for item dietary-tag assignments, allergen assignments/notices, and option-group assignments.
- [x] Provide list endpoints for shared dietary/allergen registries. Vendors assign existing entries; registry creation/renaming stays centrally controlled.
- [x] Add vendor-scoped option-group and option management with server-side ownership and selection validation.
- [x] Apply relationship updates transactionally and write actor-attributed audit records for metadata, group, option, and item-assignment changes.

**Manager UI**

- [x] Add a separate item-details editor for dietary/allergen metadata and option-group assignment, keeping the basic item form compact.
- [x] Let managers configure reusable option groups with required/optional and min/max selection rules.
- [x] Show save, validation, loading, and error states. Keep staff out of configuration controls.

**Customer and order data**

- Keep customer menu detail as the read path and verify it filters inactive groups/options and inactive items consistently.
- [x] Keep the existing cart option selection and server validation; revalidate saved selections against active groups/options and current required/max rules during checkout, so changes cannot leave a stale cart line silently orderable.
- [x] At order creation, snapshot the dietary tags and allergen names/notices that applied at purchase time into the existing `order_items.dietary_snapshot` JSON. Preserve option labels and prices in the existing customization/order-option snapshots.
- [x] Return snapshots through order history/vendor order details so later catalogue edits do not rewrite what was purchased.
- Avoid a schema migration for these fields unless implementation shows the current JSON contract cannot represent the required stable snapshot.

### 2. Location-aware inventory — location resolution complete; inventory design next

**Resolve location first**

- [x] Replace implicit “first active vendor location” assumptions in customer menu/cart with an explicit, validated location derived from the user's preferred campus/site/building when unambiguous or selected pickup location.
- [x] Ensure menu display, cart ownership, collection slots, and checkout all use the same `vendor_location_id`. Reject mismatches server-side.

**Schema and transactional service**

- Add a new location-scoped stock table, for example `vendor_location_item_inventory`, keyed uniquely by `(vendor_location_id, menu_item_id)`, with non-negative on-hand and reserved quantities, an update timestamp, and a check that reserved quantity never exceeds on-hand quantity. Derive orderable quantity as on-hand minus reserved.
- Add explicit per-order-item reservation rows with quantity, state (`reserved`, `consumed`, or `released`), expiry, and unique order-item linkage. Use them for idempotency and safe recovery.
- Add an append-only inventory movement ledger for receipts, adjustments, reservations, releases, and consumption. Record quantity delta, actor/reason where applicable, linked reservation/order, and an idempotency key so stock can be reconciled without relying on mutable totals alone.
- Leave the old menu-scoped `menu_item_inventory` table and rows untouched as legacy data. Do not backfill it blindly: menu-linked quantities may be duplicated across dates. Inspect production data and define a reviewed conversion only if meaningful live stock exists.
- Implement service-role-only database RPCs for atomic stock adjustment, reservation, consumption, expiry, and release. Lock rows and validate quantities within the same transaction as checkout/order state changes. Add request idempotency so retries cannot reserve twice.
- On payment failure/expiry or cancellation/rejection, release the hold exactly once. On confirmed fulfilment, consume it exactly once. Define expiry/reconciliation behavior before shipping the UI.
- Audit manager adjustments with actor, location, item, quantity delta, and reason. Restrict managers to their own vendor locations.

**Vendor/customer UI**

- Add manager-only stock controls to the catalogue/location workflow with a clear distinction between on-hand, reserved, and currently orderable quantities.
- Keep catalogue status as a global sale gate; calculate customer orderability from both the global status and selected-location stock. Do not overload `menu_items.status` with per-location quantity state.
- Show useful sold-out/low-stock feedback on customer menu and cart, and revalidate at checkout to handle races.

### 3. Vendor collection-slot controls

- Reuse the existing generated-slot schedule and admin pause/resume logic; add manager-only vendor-scoped read and pause/resume controls first.
- Do not expose interval, preparation capacity, or capacity editing until product rules and reserved-slot behavior are defined.
- Implement slot changes transactionally. Prevent unsafe changes to started/reserved slots, and ensure customer slot selection and checkout immediately enforce paused/full state.
- Audit each manager action and validate slot ownership through the slot's vendor location.

### 4. Catering and reporting — separate product scope

- Map existing corporate order, quote, and delivery states before adding vendor actions. Define employee request creation/status tracking and whether each order type requires admin approval.
- Specify allowed transitions for quote, accept/reject, dispatch, and delivery confirmation, with audit history and authorization rules, before building vendor screens.
- Build live, vendor-scoped reporting from verified order, item, status-history, and settlement data. Define date boundaries, timezone, pagination, and export permissions.
- Replace admin mock report sources separately; do not use client mock data for vendor reports.

### 5. Rollout and verification

- Number new database migrations from 026 onward. Add tables/indexes/RPCs without dropping legacy tables; document deployment order and rollback limits.
- Apply migrations before deploying dependent API code. Deploy server support before enabling manager/customer controls; keep new inventory enforcement behind a controlled rollout until checkout, payment, and release paths are ready together.
- [x] Apply migration 026 before deploying dependent API routes.
- [ ] Confirm item metadata and option-group writes work in the target Supabase project.
- [ ] Verify manager/staff/admin boundaries, cross-vendor denial, audit coverage, option validation, stable order snapshots, and pagination.
- Stress-check concurrent checkout, retries, payment failure/expiry, cancellation, order rejection, and duplicate release/consume attempts against real database transactions.
- Verify slot pause/full behavior against the employee picker and checkout. Reconcile stock reservations and slot counts in staging before enabling production traffic.
- Update this roadmap as each phase ships; do not mark schema, API, UI, or rollout work complete until all dependent surfaces agree.
