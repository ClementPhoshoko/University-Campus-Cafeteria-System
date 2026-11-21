# Employee Profile Plan

## Baseline before this work (verified against code and schema)

The bullets below record the pre-change state that motivated this plan. Current status is recorded in **Delivery phases** below.

- `ProfilePage.jsx` contains all profile sections in one file and switches them with local `active` state. `MainSidebar` uses buttons, not router links.
- Only `/profile` is registered. There are no `/profile/*` child routes, so sections cannot be refreshed, deep-linked, or reached with browser back/forward.
- `AuthContext` reads the full `profiles` row directly from Supabase. It also writes `notification_preferences.onboarding_completed` directly from `localStorage`. It exposes no `refreshProfile` or `updateProfile` method.
- Profile save handlers only merge into local `displayProfile` state. Nothing is persisted by the profile UI.
- There is no server profile route, controller, service, validator, or OpenAPI path. `/auth/me` returns only a bootstrap subset: identity, roles, workplace fields, and preferred-location IDs.
- The schema already has the required profile columns, but:
  - `preferred_building_id` is not constrained to belong to `preferred_site_id`.
  - `notification_preferences` has no key/type contract.
  - `dietary_preferences` and `allergy_indicators` are untyped JSONB arrays.
  - `authenticated` can currently update `email`, `employee_number`, `is_active`, and other protected columns directly through Supabase because RLS is row-wide, not column-scoped.
  - There is no database audit trigger on `profiles`.
- Favourites tables and APIs already exist, but the profile page still renders sample arrays. The favourite list endpoints are not paginated and are not documented in OpenAPI.
- `GET /sites` and `GET /sites/:siteId/buildings` already support `page`, `limit`, and `search`; the profile does not use them and currently edits raw UUID text.
- `useRoles()` already derives platform roles from `user_roles` and active vendor roles from `vendor_users`. Read-only display can be moved to a server endpoint so the same effective-role helper used by admin is reused.
- Password recovery and sign-out mechanisms exist. The current “Reset password” button has no handler.
- There is no avatar column, saved-payment API, or session-listing/revocation API. Do not imply those controls are supported.

## Production decisions

These decisions replace the open questions in the earlier plan.

1. **Single source of truth.** Express `/profile` is the canonical profile read/write path. Auth bootstrap, profile pages, and onboarding state must all use it. Remove direct Supabase profile reads/writes from feature code.
2. **Self-service allowlist.**
   - Editable by the employee: `full_name`, `preferred_site_id`, `preferred_building_id`, `dietary_preferences`, `allergy_indicators`, and supported notification keys.
   - Read-only in employee profile: `id`, `email`, `employee_number`, `department`, `business_unit`, `cost_centre`, `is_active`, timestamps, and all roles.
   - `department`, `business_unit`, and `cost_centre` stay admin/HR-owned because they affect approvals and reporting. `full_name` is a display-name field and may be self-edited.
3. **Preferences stay free-form arrays for v1.** Validate them as arrays of short, non-empty strings. Do not silently convert them to vendor dietary/allergen registry IDs; that needs a separate data-model decision. Label allergy input as personal indicators, not an allergen-safety guarantee.
4. **Notification rules.** `transactional` is always forced to `true`. Optional keys are `order_updates`, `promotions`, and `collection_reminders`. `onboarding_completed` is app-managed and accepted only through the canonical API, not exposed as a preference toggle. Unknown stored keys are preserved; unknown incoming patch keys are rejected.
5. **Location rules.** Only active sites/buildings may be selected. A building requires a site and must belong to it. Clearing the site clears the building. Clearing the building alone is allowed.
6. **Security.** Password reset means navigating to `/forgot-password` to request a recovery link. Sign-out is current-device only. No avatar, payment-card, or all-session controls.
7. **Audit.** Profile mutations write an explicit audit row containing changed field names and a reason, never raw allergy or dietary values.

## Endpoint strategy

All paths are mounted under `/api/v1`.

| Endpoint | Status | Pagination | Purpose and rules |
|---|---|---|---|
| `GET /profile` | **New** | None | Self-only full profile. Derive ID from `req.user.id`. Ignore client-supplied IDs. Return full profile object with preferences, status, and timestamps. Use `Cache-Control: no-store` because allergy data is sensitive. `404 PROFILE_NOT_FOUND` if the row is missing. |
| `PATCH /profile` | **New** | None | Self-only partial update. Accept only the allowlist below. Return the full refreshed profile. Use `no-store`. Validate all fields before writing. Write an explicit audit row. |
| `GET /profile/access` | **New** | None | Read-only effective roles from `fetchEffectiveRoleData(req.user.id)`, matching Admin → Users. Return `roles`, `platformRoles`, `vendorRoles`, and `vendorMemberships`. No role writes. |
| `GET /sites?page&limit&search` | Existing | Yes | Site selector. Use existing active-only, paginated read. Default page size 20, max 100. |
| `GET /sites/:siteId/buildings?page&limit` | Existing | Yes | Dependent building selector. Use existing active-only, paginated read. Default page size 20, max 100. |
| `GET /favorites/vendors?page&limit` | **Modify** | Add | Replace unpaginated list with `page`/`limit`, `count: exact`, stable order (`created_at desc`, `vendor_id asc`), and `pagination` in the response. Default 20, max 100. Include vendor `status`/`is_active` so inactive favourites remain removable. |
| `GET /favorites/menu-items?page&limit` | **Modify** | Add | Same contract, stable order by `created_at desc`, `menu_item_id asc`. Include item `status` and vendor status, and fix the missing `resolveAssetUrl` import. |
| `POST /favorites/vendors/:vendorId` | Existing | None | Toggle/remove vendor favourite. Keep existing audit behavior. |
| `POST /favorites/menu-items/:menuItemId` | Existing | None | Toggle/remove meal favourite. Keep existing audit behavior. |
| Password recovery / sign-out | Existing client flows | None | Use `/forgot-password` and `AuthContext.signOut()`. No new server endpoint. |

Pagination contract stays consistent with the rest of the app:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 43,
    "totalPages": 3
  }
}
```

Profile, preferences, access roles, floors, and collection points are bounded single objects or small sets and are not paginated. Favourites and location selectors are the only paginated profile data.

## Server implementation strategy

### Files to add

```text
server/src/routes/profileRoutes.js
server/src/controllers/profileController.js
server/src/services/profileService.js
server/src/validators/profileValidators.js
server/tests/profileValidation.test.js
server/tests/profileController.test.js
server/src/docs/migrations/032_profile_self_service_guard.sql
```

Mount `profileRoutes` in `server/src/app.js` beside the existing authenticated routers.

### `GET /profile`

- Guard with `authenticate`.
- Use `supabaseAdmin` with an explicit `.eq('id', req.user.id)`.
- Select only documented fields.
- Return `{ success: true, profile }` with `no-store`.
- Never read a user ID from query, params, or body.

### `PATCH /profile`

Accepted body keys:

```text
full_name
preferred_site_id
preferred_building_id
dietary_preferences
allergy_indicators
notification_preferences
```

Reject unknown keys and protected keys with `400 VALIDATION_ERROR` and `error.details`.

Validation rules:

- `full_name`: trimmed string, 1–120 characters.
- Location IDs: UUIDs; active site/building; building must belong to site; site-null implies building-null.
- Preference arrays: arrays of trimmed strings, max 50 entries, max 100 characters each, deduplicated case-insensitively.
- Notification patch: object with only `order_updates`, `promotions`, `collection_reminders`, and `onboarding_completed` as accepted patch keys. Boolean values only. Merge into the stored object, force `transactional: true`, and preserve unknown stored keys.
- Text values must not contain control characters.
- Return `400 VALIDATION_ERROR` for malformed input and `404 PROFILE_NOT_FOUND` if the profile row is missing.

Audit after a successful write:

```text
action: UPDATE
tableName: public.profiles
recordKey: req.user.id
reason: Employee profile updated
category: data
newData: { changedFields: [...] }
```

Do not put raw dietary/allergy values in audit records.

### `GET /profile/access`

- Guard with `authenticate`.
- Reuse `fetchEffectiveRoleData([req.user.id])` from `server/src/utils/effectiveRoles.js`.
- Return effective roles and source metadata. Do not query with a client-selected ID.
- No audit required for a read.

### Migration 032

Add `032_profile_self_service_guard.sql` as a deployment guard:

- Revoke `insert`, `update`, and `delete` on `public.profiles` from `authenticated`; keep `select` under existing RLS. Service role retains full access for the API and auth triggers.
- Add a trigger on `public.profiles` that:
  - rejects a non-null `preferred_building_id` when `preferred_site_id` is null;
  - rejects a building that does not belong to the active preferred site;
  - forces `notification_preferences.transactional` to `true` on every write.
- Do not drop or rewrite `menu_item_inventory` or any earlier migration.

This closes the current gap where a direct Supabase client update could bypass the API allowlist.

### Favourites changes

- Import `resolveAssetUrl` in `favoriteController.js`.
- Use the shared `parsePagination`/`buildPagination` helpers.
- Add `count: exact` and `.range(from, to)`.
- Keep response key `favorites` and add `pagination`; this is additive for existing callers.
- Include enough status fields for the UI to show inactive/unavailable favourites without blocking removal.
- Document all four favourite endpoints in OpenAPI.

### Documentation

Update `server/src/docs/openapi.yaml`:

- Add `/profile` GET/PATCH and `/profile/access` GET.
- Add `EmployeeProfile`, `ProfilePatch`, `ProfileAccess`, and `PaginatedFavorites` schemas.
- Fix `/auth/me` to document the real `{ success, user }` envelope.
- Add the four existing favourite paths.
- Extend `ErrorResponse` with optional `error.details`.

## Client architecture

### Routes

Replace the single `/profile` route in `App.jsx` with a nested protected route group:

```jsx
<Route path="/profile" element={<ProfileLayout />}>
  <Route index element={<Navigate to="/profile/overview" replace />} />
  <Route path="overview" element={<ProfileOverviewPage />} />
  <Route path="preferences" element={<ProfilePreferencesPage />} />
  <Route path="favourites" element={<ProfileFavouritesPage />} />
  <Route path="access" element={<ProfileAccessPage />} />
  <Route path="security" element={<ProfileSecurityPage />} />
  <Route path="*" element={<Navigate to="/profile/overview" replace />} />
</Route>
```

Keep the route group inside the existing `ProtectedRoute` → `AppLayout` nesting. The global profile navigation item remains `/profile`; React Router keeps it active for child routes.

### Feature structure

```text
client/src/features/profile/
  ProfileLayout.jsx
  pages/
    ProfileOverviewPage.jsx
    ProfilePreferencesPage.jsx
    ProfileFavouritesPage.jsx
    ProfileAccessPage.jsx
    ProfileSecurityPage.jsx
  components/
    ProfileSidebar.jsx
    ProfileHeader.jsx
    ProfileField.jsx
    ProfileSaveActions.jsx
    PreferenceToggle.jsx
  hooks/
    useProfile.js
    useProfileLocations.js
    useProfileFavourites.js
  profile.css
```

`ProfileLayout` owns `PageContainer`, the persistent header, route-aware sidebar, and `Outlet`. `ProfileSidebar` uses `NavLink` with `aria-current`; reuse `MainSidebar` styling and the existing horizontal mobile tab strip rather than adding a new drawer.

Clean the duplicated override block in `profile.css` and remove stale selectors while splitting pages. Keep existing design tokens and breakpoints.

### API and state layer

- Add `client/src/services/profileApi.js` with `getProfile`, `updateProfile`, and `getProfileAccess`.
- Add `client/src/services/locationApi.js` with `listSites` and `listSiteBuildings`.
- Extend existing `employeeApi.js` favourite wrappers to accept `{ token, page, limit, signal }` and return pagination.
- Every wrapper uses `session.access_token` from `useAuth()` and the shared `apiRequest` error handling.
- Update `AuthContext`:
  - `loadProfile` calls `getProfile(token)` instead of Supabase directly.
  - Add `refreshProfile()` and `updateProfile(patch)`.
  - Remove the direct `notification_preferences.onboarding_completed` Supabase write; send it through `updateProfile`.
  - Do not mark auth `initialized` until the profile request settles, so onboarding does not flash before the profile loads.
  - Update shared profile state only from confirmed server responses.
- `useProfile` exposes profile data plus `loading`, `saving`, `saved`, `error`, `dirty`, `validate`, and `save` to pages.
- Use `useFetch` for sites, buildings, favourites, and access roles. Invalidate favourites cache after toggle/removal.

## Page plan

### Overview

- Show name, email, employee number, department, business unit, cost centre, and active status as read-only except `full_name`.
- Use dependent, accessible selectors backed by the paginated site/building APIs for preferred site and building. Each selector supports loading, empty, error/retry, and “load more” pages.
- Link to `/orders` for order history. Do not duplicate order history here.

### Preferences

- Edit dietary/allergy values as normalized arrays; accept comma-separated input but trim and deduplicate it into arrays before saving.
- Show an allergy disclaimer: personal indicators help staff understand needs but are not a guarantee of allergen-safe preparation.
- Toggle only `order_updates`, `promotions`, and `collection_reminders`.
- Show dirty/saving/saved/error states. Do not auto-save silently.

### Favourites

- Replace sample data with paginated favourite vendor and meal lists.
- Use `loading`, empty, error/retry, and removal states. Previous/Next controls request the next server page.
- Link vendors to `/cafeterias/:cafeteriaId` and meals to `/cafeterias/:cafeteriaId/menu/:menuItemId`.
- Inactive or unavailable favourites remain visible with a badge and remain removable.

### Access

- Load `GET /profile/access`.
- Show effective roles as read-only cards with an icon, short description, and dynamic active state.
- Keep vendor memberships in a separate section with full-width cards that lead with the resolved vendor name.
- Never render role-edit controls or write role APIs from the profile.

### Security

- “Reset password” navigates to `/forgot-password`.
- Keep current-device sign-out with loading and error state.
- Remove any claim about listing or revoking all sessions.

## Delivery phases

### Phase 1 — Server contract and schema guard

**Status: complete — verified 2026-11-20.**

Evidence against each checkbox:

| Requirement | Evidence |
|---|---|
| Router, controller, service, validators, auth-derived scoping | `profileRoutes.js`, `profileController.js`, `profileService.js`, `profileValidators.js`, `profileRoutes.test.js`, `profileController.test.js` |
| `GET /profile`, `PATCH /profile`, `GET /profile/access` | Mounted in `app.js`; route and controller tests cover paths, auth-derived IDs, protected-field rejection, and sanitized audit output |
| Migration 032 | `032_profile_self_service_guard.sql` plus `profileMigration.test.js`; migration applied in the target Supabase project |
| Favourites pagination and `resolveAssetUrl` | `favoriteController.js` plus `favoritePagination.test.js` |
| OpenAPI and `/auth/me` envelope | `openapi.yaml` plus `openapiProfile.test.js`; explicit YAML parse succeeded with 93 paths |
| Validation, ownership, audit, and pagination tests | `profileValidators.test.js`, `profileController.test.js`, `profileMigration.test.js`, `favoritePagination.test.js` |

Verification results: server tests **145/145 passed**, client build **passed** with the pre-existing chunk-size warning, client tests **22/22 passed**, OpenAPI parse **passed**, and `git diff --check` **clean**.

- [x] Add the profile router, controller, service, validators, and auth-derived user scoping.
- [x] Implement `GET /profile`, `PATCH /profile`, and `GET /profile/access`.
- [x] Add migration 032 for direct-client write protection and profile invariants. Migration 032 has been applied in the target Supabase project.
- [x] Add paginated favourite list responses and fix `resolveAssetUrl`.
- [x] Update OpenAPI and fix the `/auth/me` envelope documentation.
- [x] Add server validation, ownership, audit, and pagination tests.

### Phase 2 — Auth/profile client foundation

**Status: complete — verified 2026-11-20.**

Evidence: `services/profileApi.js`, `services/locationApi.js`, paginated wrappers in `services/employeeApi.js`, server-backed `AuthContext.jsx`, onboarding gating in `App.jsx`, and `profileState.test.js`, `profileApi.test.js`, `authProfileContract.test.js`. Focused tests passed 10/10 and the production build passed.

- [x] Add `profileApi.js`, `locationApi.js`, and favourite wrapper changes.
- [x] Convert `AuthContext` to server-backed profile load/refresh/update.
- [x] Remove direct Supabase profile reads/writes from feature code.
- [x] Gate onboarding on settled profile state.
- [x] Add focused hook tests for confirmed-response-only updates.

### Phase 3 — Route and layout foundation

**Status: complete — verified 2026-11-20.**

Evidence: nested `/profile/*` routes and `/profile` → `/profile/overview` redirect in `App.jsx`, persistent `ProfileLayout.jsx`, route-aware `ProfileSidebar.jsx` through `MainSidebar.jsx`, five page components under `pages/`, and `profileNavigation.test.js` / `profileRouteContract.test.js`. Focused tests passed 16/16, the full client suite passed 38/38, and the production build passed. Browser smoke checks confirmed deep links, refresh, sidebar navigation, browser back/forward, `/profile` redirect, `aria-current` on the active rail item, and the mobile tab-strip CSS rules.

- [x] Add nested `/profile/*` routes and `/profile` → `/profile/overview` redirect.
- [x] Add `ProfileLayout` and route-aware `ProfileSidebar`.
- [x] Split the monolithic page into five page components.
- [x] Verify direct links, refresh, browser back/forward, desktop rail, and mobile tab strip.

### Phase 4 — Page implementation

**Status: complete — verified 2026-11-21.**

Evidence: `ProfileLayout.jsx` passes the confirmed `updateProfile` result to pages and shows shared-shimmer overview and access skeletons during initial loads; `profileForms.js` builds only allowlisted patches; `ProfileOverviewPage.jsx` edits full name inline with edit/save/cancel controls beside its label, highlights only the active input, keeps other details visible, and saves the shared `CustomDropdown` location pickers through `PATCH /profile` with the site/building draft keys mapped explicitly into the allowlisted patch; the shared dropdown flips above the trigger when space is limited and uses the project's themed scrollbar; `ProfilePreferencesPage.jsx` normalizes arrays and uses an explicit dirty/save/cancel flow for allowed notification keys; `ProfileFavouritesPage.jsx` reads paginated lists and removes through toggle APIs; `ProfileAccessPage.jsx` reads only `GET /profile/access` and renders data-driven platform-role cards plus a separate vendor-membership list using the shared `AccessSectionHeader`, `AccessRoleCard`, `AccessActiveStatus`, `VendorMembershipCard`, and `AccessEmptyState` components; vendor names come from the canonical payload and raw vendor IDs are never displayed; `effectiveRoles.js` normalizes vendor names into that payload; `ProfileSecurityPage.jsx` uses the existing OTP recovery route and current-device sign-out. Focused profile tests passed 35/35, the full client suite passed 69/69, and the production build passed.

- [x] Wire overview save flow through `PATCH /profile`.
- [x] Wire location selectors to paginated site/building endpoints.
- [x] Wire preferences through `PATCH /profile` with normalization and immutable transactional flag.
- [x] Wire favourites to paginated APIs with loading/empty/error/retry/removal.
- [x] Wire access to `GET /profile/access` as read-only.
- [x] Wire security actions to existing recovery and sign-out flows.
- [x] Clean duplicated and unused profile CSS.

### Phase 5 — Verification and rollout

**Status: static verification complete; live target-environment checks pending.**

The project owner elected to perform the live checks directly. Keep this phase open until those results are recorded here.

- [x] Apply migration 032 before deploying profile API code. Migration 032 has already been applied in the target Supabase project.
- [x] Run server tests (**145/145**), client build (**passed**, pre-existing chunk-size warning), client tests (**69/69**), OpenAPI parse (**93 paths**), and `git diff --check` (**clean**).
- [ ] Verify self-update ownership, blocked protected fields, site/building mismatch rejection, preference validation, and audit sanitization in the target environment.
- [ ] Verify favourite pagination stability, removal, inactive-item handling, and cache invalidation.
- [ ] Verify deep links, keyboard navigation, responsive layout, and sensitive-data display.
- [ ] Do not mark this roadmap complete until schema, API, UI, docs, tests, and live checks agree.

## Decisions and out of scope

- Avatar upload is out of scope until an avatar column, storage policy, and upload flow exist.
- Saved payment methods are out of scope until provider tokenization is approved.
- All-session listing/revocation is out of scope until the auth provider supports it.
- Notification delivery channels are out of scope; this feature edits preferences only.
- Vendor dietary/allergen registries remain separate from personal profile indicators for v1.
