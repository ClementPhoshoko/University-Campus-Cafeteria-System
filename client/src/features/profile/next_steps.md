# Employee Profile Plan

## Current State

- `ProfilePage.jsx` contains the overview, role/access, favourites, preferences, and security sections in one file. It switches sections with local component state rather than routes.
- `MainSidebar` provides a reusable visual navigation rail, but its items are buttons and are not linked to nested URLs.
- The app currently registers only `/profile`; profile sections are not direct-linkable pages.
- `AuthContext` reads the authenticated user's full `profiles` row directly from Supabase. It exposes the profile value, but no profile update or refresh operation.
- Profile-page save handlers only update local `displayProfile` state. They do not persist changes to Supabase or the server.
- `/auth/me` returns identity, role, workplace, and preferred-location fields, but not dietary, allergy, or notification preferences. There is no profile update route.
- The database has a `profiles` row keyed to `auth.users.id`, with `employee_number`, `full_name`, `email`, `department`, `business_unit`, `cost_centre`, `preferred_site_id`, `preferred_building_id`, `dietary_preferences`, `allergy_indicators`, `notification_preferences`, `is_active`, and timestamps.
- The schema allows a user to update their own profile row through RLS. Profile reads are also restricted by RLS, with additional access for approved support, admin, and auditor roles.
- Existing authenticated APIs provide vendor and menu-item favourites. The current profile favourites UI instead displays sample data and removes entries only in local state.
- Public authenticated site, building, floor, and collection-point reads exist. The profile currently edits preferred site/building as raw text IDs rather than selectors.
- Role data is available through `useRoles`. Users should be able to view assigned access, not assign or edit their own roles.
- Supabase password reset/update and sign-out functions exist. The current reset button is not connected to the existing recovery flow; session management only signs out the current device.
- There is no profile avatar field or saved-payment-method profile API in the inspected schema/API. Do not imply those controls are supported.

## Architecture Decision

Build the profile as a route-based feature with a persistent layout and reusable nested pages, not as one large component with local section switching.

```text
/profile                 -> redirect to /profile/overview
/profile/overview        -> identity and workplace details
/profile/preferences     -> location, dietary/allergy, notifications
/profile/favourites      -> favourite vendors and meals
/profile/access          -> read-only roles and access explanation
/profile/security        -> password recovery and sign-out
```

Use a `ProfileLayout` route component with a persistent, route-aware `ProfileSidebar` and React Router `Outlet`. Keep the existing `/profile` link working by redirecting it to the overview child route. Sidebar navigation should use links so every page supports refresh, browser back/forward, direct linking, and accessible current-page state. Use a compact horizontal navigation or drawer on mobile.

Suggested feature structure:

```text
profile/
  ProfileLayout.jsx
  next_steps.md
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
```

Extract shared controls only when they are used by more than one page. Keep page-level data loading and save behavior in the owning page or a focused hook.

## Page Plan

### Overview

- Show name, email, employee number, department, business unit, cost centre, and account-active status.
- Keep authentication- or administrator-owned values read-only. Confirm whether department, business unit, and cost centre come from an HR source before allowing self-service edits.
- Provide preferred site and building selectors using the authenticated site/building read APIs. Filter buildings by selected site and validate the relationship server-side.
- Link to the existing order-history route instead of duplicating order history inside the profile.

### Preferences

- Read and save `dietary_preferences` and `allergy_indicators` as structured arrays, not comma-separated free text alone.
- Present allergy information carefully; it is sensitive data and must not be presented as a guarantee that a meal is allergen-safe.
- Read and save supported `notification_preferences` keys. Transactional notifications required to complete an order must remain enabled; only optional notifications may be switched off.
- Keep preferences distinct from vendor menu dietary/allergen metadata.

### Favourites

- Replace sample entries with the existing authenticated favourites APIs.
- Load favourite vendors and meals with loading, empty, retry/error, and removal states.
- Link each saved vendor or meal back to its current browse/detail route. Handle items that have become inactive or unavailable without losing the user's ability to remove them.

### Role and access

- Use `useRoles` to show assigned platform and vendor roles as read-only information.
- Explain that admins control role assignment. Do not offer role changes or expose permissions beyond what the current role model supports.

### Security

- Connect password recovery to the existing forgot-password/recovery flow. Do not show a reset button that has no action.
- Keep sign-out of the current device available.
- Do not claim to list or revoke all active sessions until a supported session-management API exists.
- Do not collect or store raw payment-card details. Add saved payment methods only after an approved provider-tokenization design and API exist.

## Data and API Plan

1. Establish one authenticated profile data path. Prefer an Express profile service with `GET /profile` and a validated `PATCH /profile`; preferences may share the patch route or use a dedicated preferences route. Keep `/auth/me` for session/bootstrap needs, but avoid maintaining conflicting copies of profile fields between `/auth/me`, Supabase reads, and the profile API.
2. Derive the target profile ID from the authenticated session on the server. Never accept a client-selected user ID for profile reads or writes.
3. Whitelist self-service fields. Keep email, employee number, active status, role assignments, and timestamps read-only unless a separately approved identity/admin workflow owns them.
4. Validate JSON array shapes, allowed notification keys, field lengths, and preferred-site/building ownership relationships. Preserve `notification_preferences.transactional` as enabled.
5. Add a profile service/API client and expose loading, saving, refresh, and error state through a focused hook or `AuthContext` methods. Update shared auth profile state only from confirmed server responses; do not treat optimistic local state as persistence.
6. Use existing favourites APIs rather than adding duplicate storage or profile JSON fields.
7. Preserve RLS ownership policies and add server authorization tests. If the API uses the service role, it must explicitly scope every query and update to `req.user.id` and the approved field allowlist.

## Decisions and Out of Scope

- Confirm whether workplace fields (`department`, `business_unit`, `cost_centre`) are employee-editable or HR/admin-managed.
- Confirm whether dietary and allergy values should remain free-form profile arrays or use the existing controlled dietary/allergen catalogues.
- Avatar upload is deferred until an avatar field, storage policy, and upload flow are defined.
- Saved payment methods are deferred until provider tokenization is approved and implemented.
- All-session listing/revocation is deferred until the authentication provider/API supports it.
- Notification delivery and preferences are separate concerns: this feature edits preferences but does not implement new delivery channels.

## Delivery Phases

### 1. Route and layout foundation

- Add nested `/profile/*` routes and retain `/profile` as a redirect to overview.
- Split the current monolithic component into the persistent layout and page components above.
- Build the route-aware sidebar from the existing profile navigation design and verify desktop/mobile navigation, keyboard focus, and deep links.

### 2. Persist profile data

- Implement the authenticated profile read/update service and field validation.
- Wire overview and preferences saves to persisted responses.
- Add dirty, saving, saved, validation, and error states; prevent silent local-only saves.
- Refresh `AuthContext` profile state after successful updates and on returning to the profile.

### 3. Replace placeholders with existing capabilities

- Use site/building selectors with dependent loading and validation.
- Connect favourites to the existing list/toggle APIs.
- Keep role/access display read-only through `useRoles`.
- Connect password recovery and current-device sign-out; remove unsupported session-management claims.

### 4. Tests and verification

- Test nested routes, redirects, direct links, browser navigation, mobile navigation, and role display.
- Test profile self-read/self-update ownership, blocked user-ID/role/email/status changes, field validation, and site/building consistency.
- Test preference persistence and immutable transactional notification behavior.
- Test favourite API integration, empty/error/retry states, and removal.
- Test password-recovery links and current-device sign-out without claiming unsupported session controls.
- Review accessibility, sensitive-data display, and responsive layouts.