-- ---------------------------------------------------------------------------
-- 037_vendor_roles_derived_only.sql
--
-- `vendor_staff` and `vendor_manager` are effective roles derived from active
-- `public.vendor_users` memberships. Older admin role edits could persist those
-- labels in `public.user_roles`, leaving stale access after a vendor manager
-- deactivated a staff member. This migration removes those stale rows and
-- prevents them from being written again.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

delete from public.user_roles
where role::text in ('vendor_staff', 'vendor_manager');

alter table public.user_roles
  drop constraint if exists user_roles_platform_roles_only;

alter table public.user_roles
  add constraint user_roles_platform_roles_only
  check (role::text not in ('vendor_staff', 'vendor_manager'));

comment on constraint user_roles_platform_roles_only on public.user_roles is
  'Vendor roles are derived from active vendor_users memberships and must not be stored as platform roles.';
