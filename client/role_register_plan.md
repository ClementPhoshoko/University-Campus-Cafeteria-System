# Registration Plan — Campuses, Buildings, Cafeterias & Vendors

Production plan for how the platform registers and administers **campuses (sites)**, **buildings/floors**, **collection points**, and **vendors**.

Sources consulted:

- `README.md` — §4.3 Administration portal, §5 User Roles, §11 Configuration areas, §15 REST API Plan, §16 OpenAPI.
- `server/src/docs/merchant_munchies_supabase.sql` — schema, RLS policies, audit triggers.
- `server/src/docs/openapi.yaml` — current API contract (auth + admin users only).
- `server/src/routes/adminRoutes.js`, `server/src/controllers/adminController.js`, `server/src/middleware/*` — existing admin API pattern.
- `client/src/features/admin/AdminCafeteriaList.jsx`, `AdminVendorList.jsx`, `AdminVendorDetail.jsx`, `AdminSettingsPage.jsx` — existing admin UI shells.
- `client/src/services/api.js`, `auth.js` — client service pattern (no admin API client yet).

---

## 1. Terminology decision (important)

The design brief says **campus**, but the database schema and the admin UI call it **site**. Machine-facing references use **site**; user-facing and product copy keeps **campus**:

- DB table: `public.sites`
- Client mock UI: "Sites" tab, `ADMIN_SITES`, `/admin/cafeterias/:id`
- README §15: now aligned with `GET/POST/PATCH /admin/sites` (and public `GET /sites`) after the technical-only terminology pass — API paths, OpenAPI tags and service names use `site`.

**Decision (confirmed):** standardise machine-facing references on **site = campus**, keep "campus" in user-facing/product copy and place names. No aliases required. Failing to standardise would create ambiguous route names, duplicated docs, and confusion in the audit trail.

There is no separate "cafeteria" entity. In this platform a cafeteria is a **campus/site** with **buildings** and **collection points** served by **vendors**. "Cafeterias" in the admin UI is the locations manager, not the vendor list.

---

## 2. Entities & hierarchy

```
sites (campus)                 vendors (merchant)
├─ buildings                   ├─ vendor_users (staff / manager)
│  ├─ floors                   └─ vendor_locations  (vendor operating at site+building)
│  └─ collection_points              ├─ operating_hours
│  └─ delivery_locations             ├─ menus → menu_items / option_groups / inventory
└─ (feeds orders/building)          ├─ collection_slots
                                    └─ orders (site, building, collection_point)
```

Key schema facts that shape the flows:

| Entity | Table | Quirks |
|---|---|---|
| Campus | `sites` | `name` unique, `code` unique (nullable), timezone, lat/lng |
| Building | `buildings` | `unique (site_id, name)`, `unique (site_id, code)`; belongs to exactly one site |
| Floor | `floors` | `unique (building_id, name)` |
| Collection point | `collection_points` | `unique (building_id, name)`; optional `floor_id`; `is_express` |
| Delivery location | `delivery_locations` | same shape as collection points (corporate delivery) |
| Vendor | `vendors` | `slug` NOT NULL unique; status enum `pending/approved/suspended/inactive` (**no `rejected`**) |
| Vendor membership | `vendor_users` | PK `(user_id, vendor_id)`, role `staff/manager`, `is_active` |
| Vendor location | `vendor_locations` | `unique (vendor_id, site_id, building_id)` — a vendor cannot have two outlets at the same building; refs a collection point |

---

## 3. Roles & permissions

Sources: README §5 table, `private.*` helper functions in the schema.

| Capability | Admin | Vendor manager | Support / Finance / Auditor |
|---|---|---|---|
| Register / edit campus, building, floor, collection point | ✅ | ❌ | ❌ |
| Deactivate a campus or building | ✅ | ❌ | ❌ |
| Create vendor (onboarding) | ✅ | ❌ | ❌ |
| Approve / suspend / reject vendor | ✅ | ❌ | ❌ |
| Assign vendor staff / manager accounts | ✅ | ✅ (own vendor) | ❌ |
| Attach vendor to a site+building (location) | ✅ | ✅ (own vendor, schema allows) | ❌ |
| Configure hours, slots, order rules | ✅ | ✅ (own locations) | ❌ |
| Read locations, vendors, config | ✅ | ✅ (own) | ✅ (support/auditor view logs) |

RLS already enforces most of this (`*_authenticated_read`, `vendor_*_admin_or_manager_*`, `is_admin()` helpers). **Admin actions happen server-side through the Express API** (service role) as a second enforcement layer — never by bolting write buttons directly onto Supabase Data API calls from the client.

**Schema gap to fix:** `sites`, `buildings`, `floors`, `collection_points`, `delivery_locations` currently have only `grant select` and read policies — there are **no authenticated write grants or admin write policies** for them. That is fine if all creation goes through the Express service role (recommended); do **not** add client-side write grants for these tables.

---

## 4. Recommended API surface

All under `/api/v1`, model the existing pattern in `adminRoutes.js`:

```js
adminRouter.use(authenticate, requireRole('admin'));
```

### 4.1 Locations (new)

```text
GET    /admin/sites                          # list + pagination + building/vendor/pickup counts
POST   /admin/sites                          # register campus
PATCH  /admin/sites/:siteId                  # edit, activate/deactivate (is_active)
GET    /admin/sites/:siteId/buildings        # list buildings for a campus
POST   /admin/sites/:siteId/buildings        # register building
PATCH  /admin/buildings/:buildingId          # edit, activate/deactivate
POST   /admin/buildings/:buildingId/floors   # add floor
PATCH  /admin/floors/:floorId                # edit, activate/deactivate
POST   /admin/buildings/:buildingId/collection-points
PATCH  /admin/collection-points/:cpId        # edit, toggle is_express / is_active
POST   /admin/buildings/:buildingId/delivery-locations
PATCH  /admin/delivery-locations/:dlId
```

### 4.2 Vendors (new)

```text
GET    /admin/vendors?status=&search=&campus=&page=&limit=
POST   /admin/vendors                        # create onboarding application (status # pending)
GET    /admin/vendors/approvals              # pending applications (+ category, location, submitted)
GET    /admin/vendors/:vendorId              # detail: profile, locations, staff, hours, activity
PATCH  /admin/vendors/:vendorId              # profile edit (name, description, contact, logo, catering)
PATCH  /admin/vendors/:vendorId/approval     # body: { decision: approve|reject|suspend|activate, reason? }
POST   /admin/vendors/:vendorId/locations    # attach to site+building; body: site/building/cp, service_state, hours
PATCH  /admin/vendor-locations/:locId        # hours, service_status (open/closed/busy)
POST   /admin/vendors/:vendorId/users        # add member { user_id | email, role: staff|manager }
DELETE /admin/vendors/:vendorId/users/:userId
```

### 4.3 Elsewhere

```text
GET    /admin/dashboard        # exists in README §15 — dashboard already built as mock; wire later
GET    /admin/audit-logs       # read for the Audit Log page
PATCH  /admin/configuration    # settings page (fees/tax/rules) — later phase
```

---

## 5. Registration flows (the "how")

### 5.1 Register a campus (site)

1. Admin opens **Cafeterias → Sites** (`AdminCafeteriaList.jsx`), clicks **New site** (existing `NewSiteModal`).
2. Form fields (modal already has them): name, code, address, latitude, longitude, timezone.
3. Submit → `POST /admin/sites`.
4. Validation (mirror DB constraints):
   - `name` required + unique → 409 `SITE_NAME_EXISTS` if taken.
   - `code` optional but unique → 409 `SITE_CODE_EXISTS`.
   - lat/lng numeric range; timezone defaults `Africa/Johannesburg`.
5. On success the site appears in the Sites tab and its KPI counts update.

### 5.2 Register a building

1. **Sites → Buildings** tab → **New building** modal (to be built: site selector, name, code, address, lat/lng).
2. `POST /admin/sites/:siteId/buildings`.
3. Constraints: `name` and `code` unique **per site** (`unique (site_id, name)`), so an error returns `BUILDING_NAME_EXISTS` scoped to the campus.

### 5.3 Register a floor / collection point / delivery location

- Floor: `POST /admin/buildings/:buildingId/floors` — name + level number; unique per building.
- Collection point: `POST /admin/buildings/:buildingId/collection-points` — name, optional floor, `is_express` toggle, instructions; unique per building.
- Delivery location: same shape, used by corporate orders.

These are small additive modals on the **Collection points** tab. The site dropdown already exists in that tab (custom dropdown with click-outside).

### 5.4 Vendor onboarding & approval (the core workflow)

1. **Add vendor** in `AdminVendorList.jsx` (button exists, has no handler) opens an onboarding modal:
   - Business details: name, description, logo (upload to private `vendor-assets` bucket → signed URL), support email/phone, corporate catering toggle.
   - First physical presence: site (campus) → building → collection point, default service hours.
   - Category tags (store in `menu_categories`, `is_active`).
2. `POST /admin/vendors` sets `status = 'pending'`, generates a unique `slug` (retry-on-collision), inserts the vendor **plus** an initial `vendor_locations` row.
3. Vendor appears in **Pending approvals** tab. **Approval decision**:
   - **Approve** → `PATCH /admin/vendors/:vendorId/approval` sets `status='approved'`, `approved_at=now()`, `approved_by=<admin id>`; send the applicant the existing welcome email template (or a dedicated vendor-approved template) via `services/email`.
   - **Reject** → decide storage: the `vendor_status` enum has **no `rejected` value**. **Recommended schema change:** add `'rejected'` to the enum (small migration). Fallback (no migration): set `status='inactive'` and record the rejection reason in `audit_logs` + notify the applicant with the reason collected in the existing `ApprovalModal` textarea.
   - **Bulk approve** (multi-select already in the UI): loop the same approval call synchronously; partial failures return per-vendor results so the UI can keep rather than discard rejected rows.
4. Once approved, the vendor manager logs in (or the admin invites them), and `vendor_users` rows are created for their staff (`role: staff|manager`).

### 5.5 Activate/deactivate, suspend

- `PATCH /admin/vendors/:vendorId/approval` with `decision: suspend|activate` toggles `status` between `suspended` and `approved`.
- Deactivating a **campus/building** sets `is_active = false` — RLS read policies already hide inactive locations from employees; existing orders remain intact (FKs are `restrict`, not cascade).

---

## 6. Validation, idempotency & error codes

- Keep the `{ success, error: { code, message } }` envelope used by existing controllers.
- Uniqueness conflicts return **409** with code + the offending field.
- `POST /admin/vendors` must be idempotent-able via a client-generated `onboarding_key` (dedupe) and must retry slug generation (`vendors.slug` is NOT NULL unique).
- Server-side validation only (mirror of DB checks), since RLS cannot be bypassed but client validation can.
- Any `PATCH /admin/*` that changes `is_active` or `status` is a state transition → every one of these must produce an audit row (see §7).

---

## 7. Audit & compliance (production requirement — README §11: "All configuration changes must be auditable")

Current audit triggers cover `vendors`, `vendor_users`, `user_roles`, … but **not** `sites`, `buildings`, `floors`, `collection_points`, `delivery_locations`, `vendor_locations`, `operating_hours`.

**Gap 1 — missing triggers:** add `audit_row_change` triggers for those location tables in the schema migration.

**Gap 2 — actor is null for service-role writes:** `audit_row_change` uses `auth.uid()`, which is **null** when the Express API writes with the service role. Without action, every admin registration would be un-attributable.

**Recommended fix (do both):**
1. Add audit triggers for location tables (catches any direct DB/seed changes).
2. In the Express admin controllers, after each successful mutation also insert an explicit `audit_logs` row: `actor_user_id = req.user.id, action = 'INSERT'/'UPDATE', table_name = 'public.<table>', record_key = <id>, new_data = to_jsonb(payload)`.

This yields an audit trail that is complete **and** correctly attributed. Reuse it for: who registered the campus, who approved the vendor, who suspended the outlet, and the reject reason.

---

## 8. Frontend implementation plan (client)

### 8.1 Service layer
- New `client/src/services/adminApi.js` following `services/auth.js`/`api.js`; uses `VITE_API_BASE_URL` + bearer token from `useAuth`. Expose typed helpers: `listSites`, `createSite`, `updateSite`, `createBuilding`, `createFloor`, `createCollectionPoint`, `listVendors`, `createVendor`, `approveVendor`, `rejectVendor`, `setVendorStatus`, `createVendorLocation`, `listAuditLogs`.

### 8.2 Cafeterias page (`AdminCafeteriaList.jsx`)
- Wire `NewSiteModal` submit → `createSite` with loading, inline error (409 uniqueness), success toast, list refresh.
- Add **New building** and **New collection point** modals matching the existing modal design system (`admin-modal`, `admin-form-grid`, `admin-input`).
- Replace `ADMIN_SITES`/`ADMIN_BUILDINGS`/`ADMIN_COLLECTION_POINTS` imports with API data once endpoints are live.

### 8.3 Vendors page (`AdminVendorList.jsx`)
- Wire **Add vendor** button (currently a dead ghost button) to the onboarding modal.
- Replace `PENDING_VENDOR_APPROVALS` with `/admin/vendors/approvals`; approve/reject call the approval endpoint and keep the existing `ApprovalModal` (reject reason textarea persists to the API and into the audit log).
- Bulk approve calls the endpoint per row and keeps successes, surfaces failures.

### 8.4 Vendor detail (`AdminVendorDetail.jsx`)
- Later phase: location management (add/configure outlets, hours via `operating_hours`), staff management (`vendor_users`), and `service_status` toggles per location.

### 8.5 Settings / audit (`AdminSettingsPage.jsx`, `AdminAuditLogPage.jsx`)
- Later phase: `PATCH /admin/configuration` for fees/tax/rules (tables already exist: `fee_rules`, `tax_rates`, `cancellation_rules`, `platform_settings`, `feature_flags`); `GET /admin/audit-logs` for the Audit Log page.

---

## 9. Recommended implementation phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Foundation** | Decide terminology (site = campus); super-admin ensures seed admin exists (`SUPER_ADMIN_EMAIL` + `bootstrapSuperAdmin.js`). | One working admin login; roles visible in `/admin/users`. |
| **1 — Schema patches** | Add `vendor_status` value `rejected`; add audit `audit_row_change` triggers for `sites`, `buildings`, `floors`, `collection_points`, `delivery_locations`, `vendor_locations`, `operating_hours`. | Audit rows appear for location writes; actor attribution works for service-role writes (via explicit controller audit insert). |
| **2 — Locations API + UI** | Build `/admin/sites*`, `/admin/buildings*`, floors, collection/delivery points; wire `AdminCafeteriaList` modals (New site / building / collection point) to it. | Admin can fully register a campus hierarchy end-to-end; duplicates rejected with 409; audit log shows who created what. |
| **3 — Vendor onboarding + approval** | `POST /admin/vendors`, approvals listing, `PATCH .../approval` (approve/reject/suspend/activate), logo upload via `vendor-assets` bucket, email the applicant; wire `AdminVendorList` **Add vendor** + approval flows. | End-to-end: application → approval/rejection → vendor visible only after `approved`. |
| **4 — Vendor operations** | Vendor locations/hours/staff endpoints; `AdminVendorDetail` management; `operating_hours`, `collection_slots`. | Vendor managers can operate on their outlets; admins can configure them. |
| **5 — Config, audit, reports** | `PATCH /admin/configuration`, `GET /admin/audit-logs`, `GET /admin/dashboard` wiring; settings page + audit log page go live. | Every §11 configuration change is auditable and page-driven. |
| **6 — Hardening / rollout** | Bulk CSV import for pilot locations; rate limiting; idempotency keys on POSTs; OpenAPI additions for all new endpoints; RBAC matrix tests; load test ordering reads. | Production-ready review + demo against a seeded pilot campus. |

---

## 10. Database migration summary

```sql
-- A. Vendor status gains an explicit rejected state
alter type public.vendor_status add value 'rejected';

-- B. Audit coverage for all location + vendor-config tables
-- (extend the existing audit_row_change DO loop to also include:)
--   'sites','buildings','floors','collection_points','delivery_locations',
--   'vendor_locations','operating_hours'
```

No changes are required for registrations to respect referential integrity: `buildings.site_id`, `floors.building_id`, `collection_points.building_id`, `vendor_locations.(vendor_id, site_id, building_id)` all already enforce the hierarchy, and `on delete restrict` protects history.

---

## 11. Seed / pilot data

For demo and pilot:

1. Run an idempotent seed script (service role) that creates the Merchant Place pilot campus → buildings → floors → collection points, following the same flows the admin API will use, so the UI and seed data never diverge.
2. Keep `adminMockData.js` shapes in sync with the real API responses (`id`, `is_active`, `code`, `site_name`, counts) so the swap from mock → live data in `AdminCafeteriaList`/`AdminVendorList` is mechanical.

---

## 12. Open decisions to confirm

- **Terminology — DECIDED (technical-only consistency):** machine-facing references (API paths, service names, OpenAPI tags, DB-entity lists) use **site**; user-facing and product copy keeps **campus** (README §15 now uses `/sites` and `/admin/sites`). Confirmed scope: do not touch proper-noun place names (e.g. `Main Campus Cafe`, `North Campus`) or marketing copy.
- **Vendor rejection storage:** add `'rejected'` to the enum (recommended) vs. reusing `inactive` + audit note.
- **Vendor-manager location self-service:** schema already allows managers to create `vendor_locations`/`operating_hours` for their own vendor. Decide whether to keep that self-service or route everything through admin in this release.
- **Who may create the first admin:** handled by `SUPER_ADMIN_EMAIL` bootstrap; confirm ownership of that account and rotation of the service-role key before production.

---

### References in the repo

- Existing admin auth pattern to extend: `server/src/routes/adminRoutes.js:15`, `server/src/middleware/auth.js` (`requireRole`).
- Controllers to model after: `server/src/controllers/adminController.js` (validation, error envelope, `supabaseAdmin`).
- UI shells to wire: `client/src/features/admin/AdminCafeteriaList.jsx` (`NewSiteModal`), `AdminVendorList.jsx` (`ApprovalModal`, Add vendor button).
- Email infra to reuse for applicant notifications: `server/src/services/email/*` + `server/src/docs/SEND_EMAIL_HOOK_SETUP.md`.
- Client service pattern: `client/src/services/auth.js`, `api.js`.