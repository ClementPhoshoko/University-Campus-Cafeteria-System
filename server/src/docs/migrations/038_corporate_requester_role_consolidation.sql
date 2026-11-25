-- Phase 5B-0a: add the consolidated requester enum value.
--
-- PostgreSQL will not allow a new enum label to be referenced until the
-- transaction that added it is committed. Run this file by itself, wait for a
-- successful result, then run 038b_corporate_requester_role_backfill.sql.
--
-- Safe to run more than once.

alter type public.app_role add value if not exists 'catering_requester';
