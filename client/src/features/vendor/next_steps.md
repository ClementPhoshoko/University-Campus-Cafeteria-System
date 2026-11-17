# Vendor Portal Next Steps

## Scope

Dated and recurring menu planning are out of scope. Keep the existing `/vendor/menus` client alias because it redirects to reusable catalogue management. Keep migration `021_vendor_menu_planning.sql` because it adds per-item availability for today's published menu; do not remove or roll it back.

## Existing Foundations

- The schema includes `menu_item_inventory`, dietary/allergen associations, option groups, collection slots, corporate orders, quotes, and deliveries.
- Vendor staff can operate the active order queue and change availability on today's published menu.
- Managers can manage reusable categories and catalogue items and invite or revoke staff invitations.
- Admin tools can manage the active vendor roster and pause/resume generated collection slots. These APIs are admin-only today.
- The vendor order API currently returns at most 100 records; the UI paginates that loaded subset locally.
- The admin reports UI uses mock data. There are no live vendor report or catering routes.

## Cross-surface Dependencies

- Employee menu detail and cart must display dietary/allergen information and support configured options. Order item snapshots must preserve the selected options and relevant dietary/allergen details.
- Employee menu and cart availability must reflect vendor stock and slot changes. Checkout must reserve inventory atomically, and cancellation/failure flows must release it safely.
- Employee corporate request creation and any requester-facing status flow are required alongside vendor catering management. Confirm whether an admin approval workflow is required for each corporate order type before defining transitions.
- Admin remains authoritative for assigning managers. Reuse its active vendor roster and generated-slot tools where possible; expose only staff-level access management and permitted slot controls to vendor managers.
- Decide whether administrators also need catalogue, dietary/allergen, option, or inventory editing. Do not duplicate those controls unless an operational or compliance requirement calls for them.
- If reports are needed in the admin portal, replace the current mock report sources with live reporting separately; vendor-scoped reports must not be derived from client mock data.

## Implementation Plan

### 0. Vendor workspace shell

- Use the reusable, role-aware `VendorWorkspaceLayout` for vendor navigation.
- Keep Overview available to staff and managers; show manager-only catalogue and team views only to managers.
- Add future navigation entries only when the corresponding workflow is implemented and server authorization is in place.

### 1. Inventory and menu details

- Add manager-scoped APIs and editor fields for dietary tags, allergens, and option groups, reusing existing tables and customer read paths.
- Update employee menu detail and cart UI to show dietary/allergen data and let customers select configured options; persist selections in order snapshots.
- Add per-menu-item quantity management using `menu_item_inventory`.
- Enforce stock reservation atomically during employee checkout. Reflect remaining availability in menu/cart, release reservations on cancellation or failed order completion, and prevent duplicate reservation on retries.
- Add audit events for manager changes to item metadata and inventory.

### 2. Queue pagination and vendor roster

- Add server-side pagination, total counts, and supported status filters to `GET /vendor/orders`.
- Define stable server-side ordering that preserves collection-time priority; add or confirm indexes for the queue query.
- Replace client-only slicing of the first 100 orders with API-driven pagination or load-more behavior.
- [x] Add a manager-scoped active-staff list and staff access deactivation endpoint. Managers can deactivate only staff in their own vendor; matching pending staff invitations are revoked and the change is audited atomically. Apply `server/src/docs/migrations/023_vendor_manager_staff_roster.sql` before enabling it.
- Managers may manage staff membership only. They must not assign, edit, or remove manager access, and all actions must be vendor-scoped and audited.

### 3. Vendor collection-slot controls

- Reuse the existing generated-slot schedule and admin pause/resume behavior.
- Add vendor-manager-scoped APIs and UI for permitted schedule controls.
- Decide explicitly whether managers may change capacity, interval, or preparation capacity; the current admin UI only supports pausing/resuming generated slots.
- Protect reserved and already-started slots from unsafe edits, and keep reservation/capacity changes atomic.
- Ensure the employee slot picker and checkout validation immediately respect paused, full, or changed slots.

### 4. Catering and reporting

- Build vendor catering request views and actions against the existing corporate order, quote, and delivery schema.
- Confirm or implement the employee corporate request-entry and requester status flows needed to create and track requests handled by vendors.
- Confirm whether admin approval is required and connect vendor actions to the applicable approval flow.
- Define vendor transitions for quoting, accepting/rejecting, dispatch, delivery confirmation, and audit history before implementing the UI.
- Add real report endpoints based on order, order-item, status-history, and settlement data. Do not treat the current admin mock figures as report sources.
- Scope reports by vendor and authorized date range; paginate detailed results and define export permissions.
- If admin reports are in scope, update them to consume the same verified data definitions while retaining admin-wide access controls.

### 5. Verification and rollout

- Test cross-vendor access denial and staff-versus-manager permissions for every new route.
- Test inventory reservation under concurrent checkouts, retries, cancellation, and failure recovery.
- Test employee menu/cart rendering and order snapshots for options, dietary tags, allergens, and stock availability.
- Test queue filters, pagination boundaries, stable ordering, and refresh after status changes.
- Test slot capacity, pause/resume, and behavior for reserved or started slots.
- Test employee slot selection and checkout after a slot is paused, filled, or changed.
- Test catering state transitions, report totals against source records, and audit coverage.
- Test requester, vendor, and any required admin approval flows end to end.
- Apply and verify required migrations and background scheduler configuration in staging before enabling each feature.
