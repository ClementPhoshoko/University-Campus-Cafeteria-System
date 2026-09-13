-- Disambiguate the two foreign keys from user_roles -> profiles so that
-- PostgREST can resolve the embed hint (user_roles!user_id(role)) cleanly.
-- PostgreSQL auto-names both constraints "user_roles_*_fkey" which creates
-- ambiguity when Supabase tries to join profiles with user_roles.

-- Drop the auto-generated constraints (names follow PG convention)
alter table public.user_roles
  drop constraint if exists user_roles_user_id_fkey,
  drop constraint if exists user_roles_granted_by_fkey;

-- Re-create with explicit, distinct names
alter table public.user_roles
  add constraint user_roles_user_id_fk
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.user_roles
  add constraint user_roles_granted_by_fk
    foreign key (granted_by) references public.profiles(id) on delete set null;
