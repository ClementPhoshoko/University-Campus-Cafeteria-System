import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const requesterEnumSql = read('..', 'src', 'docs', 'migrations', '038_corporate_requester_role_consolidation.sql');
const requesterBackfillSql = read('..', 'src', 'docs', 'migrations', '038b_corporate_requester_role_backfill.sql');
const quoteSql = read('..', 'src', 'docs', 'migrations', '039_corporate_vendor_quotes.sql');
const deliverySql = read('..', 'src', 'docs', 'migrations', '040_corporate_delivery_workflow.sql');
const canonicalSql = read('..', 'src', 'docs', 'merchant_munchies_supabase.sql');

const legacyRequesterRoles = [
  'executive',
  'executive_assistant',
  'meeting_organiser',
  'training_coordinator',
  'cost_centre_owner',
];

const phase5bFunctions = [
  'create_corporate_quote(uuid, uuid, uuid, text[], numeric, numeric, numeric, timestamptz, text)',
  'submit_corporate_quote(uuid, uuid, uuid, text[])',
  'withdraw_corporate_quote(uuid, uuid, uuid, text[])',
  'accept_corporate_quote(uuid, uuid, text[])',
  'reject_corporate_quote(uuid, uuid, text[], text)',
  'request_corporate_reapproval(uuid, uuid, text[], text)',
  'decide_corporate_approval(uuid, uuid, text[], text, text)',
  'dispatch_corporate_order(uuid, uuid, uuid, text[], text, text, text)',
  'mark_corporate_delivered(uuid, uuid, uuid, text[])',
  'confirm_corporate_delivery(uuid, uuid, text[], text)',
];

test('migration 038 separates the enum add from its first use', () => {
  assert.ok(requesterEnumSql.includes("alter type public.app_role add value if not exists 'catering_requester'"));
  assert.doesNotMatch(
    requesterEnumSql,
    /'catering_requester'::public\.app_role/,
    'a new enum value cannot be used in the same transaction that adds it',
  );
});

test('migration 038b backfills requester roles without deleting legacy rows', () => {
  assert.ok(requesterBackfillSql.includes("raise exception 'Run 038_corporate_requester_role_consolidation.sql first'"));
  for (const role of legacyRequesterRoles) {
    assert.ok(requesterBackfillSql.includes(`'${role}'`), `missing legacy role ${role}`);
  }
  assert.ok(requesterBackfillSql.includes("select distinct ur.user_id, 'catering_requester'::public.app_role"));
  assert.ok(requesterBackfillSql.includes('and not exists ('));
  assert.ok(requesterBackfillSql.includes('on conflict (user_id, role) do nothing'));
  assert.ok(requesterBackfillSql.includes('create or replace function private.is_catering_requester()'));
  assert.ok(requesterBackfillSql.includes('security definer'));
  assert.ok(requesterBackfillSql.includes("set search_path = ''"));
  assert.ok(requesterBackfillSql.includes('grant execute on function private.is_catering_requester() to authenticated'));
  assert.ok(requesterBackfillSql.includes('revoke execute on function private.is_catering_requester() from anon'));
});

test('migration 039 adds vendor quotes and service-role-only re-approval RPCs', () => {
  assert.ok(quoteSql.includes('add column if not exists accepted_quote_id uuid references public.corporate_quotes(id) on delete set null'));
  assert.ok(quoteSql.includes('add column if not exists quoted_total numeric(12,2)'));
  assert.ok(quoteSql.includes('create index if not exists idx_corporate_orders_accepted_quote'));

  for (const name of [
    'create_corporate_quote',
    'submit_corporate_quote',
    'withdraw_corporate_quote',
    'accept_corporate_quote',
    'reject_corporate_quote',
    'request_corporate_reapproval',
    'decide_corporate_approval',
  ]) {
    assert.ok(quoteSql.includes(`create or replace function public.${name}(`), `missing function ${name}`);
  }

  assert.ok(quoteSql.includes("array['vendor_manager']::text[]"));
  assert.ok(quoteSql.includes("array['catering_requester']::text[]"));
  assert.ok(quoteSql.includes("array['admin','finance']::text[]"));
  assert.ok(quoteSql.includes('and is_active and role = \'manager\'::public.vendor_member_role'));
  assert.ok(quoteSql.includes('v_reapproval := v_quote.total > v_order.total;'));
  assert.ok(quoteSql.includes('sequence_no = 2'));
  assert.ok(quoteSql.includes("approval_status = case when v_reapproval then 'pending'::public.approval_status else approval_status end"));
  assert.ok(quoteSql.includes('quoted_total = v_quote.total'));
  assert.ok(quoteSql.includes("'public.corporate_quotes', v_quote.id::text"));
  assert.ok(quoteSql.includes("'public.corporate_orders', p_order_id::text"));
});

test('migration 040 adds corporate-only dispatch, delivery, and confirmation', () => {
  for (const name of [
    'dispatch_corporate_order',
    'mark_corporate_delivered',
    'confirm_corporate_delivery',
  ]) {
    assert.ok(deliverySql.includes(`create or replace function public.${name}(`), `missing function ${name}`);
  }

  const corporateTransition = "v_is_corporate and old.status in ('payment_confirmed', 'preparing') and new.status = 'delivery_in_progress'";
  assert.ok(deliverySql.includes(corporateTransition));
  assert.ok(deliverySql.includes("v_is_corporate and old.status = 'delivery_in_progress' and new.status in ('delivered','cancelled','refund_pending')"));
  assert.ok(deliverySql.includes("v_is_corporate and old.status = 'delivered' and new.status in ('completed','refund_pending')"));
  assert.ok(deliverySql.includes("array['vendor_manager']::text[]"));
  assert.ok(deliverySql.includes("array['catering_requester']::text[]"));
  assert.ok(deliverySql.includes("v_order.status not in ('payment_confirmed'::public.order_status, 'preparing'::public.order_status)"));
  assert.ok(deliverySql.includes('v_corporate.accepted_quote_id is null'));
  assert.ok(deliverySql.includes("set status = 'completed'"));
  assert.ok(deliverySql.includes('recipient_confirmed_at = now()'));
  assert.ok(deliverySql.includes('recipient_user_id = p_actor_id'));
  assert.ok(deliverySql.includes("'public.corporate_deliveries', v_delivery.id::text"));
});

test('every Phase 5B RPC is revoked from clients and granted only to service_role', () => {
  for (const signature of phase5bFunctions) {
    assert.ok(
      quoteSql.includes(`revoke all on function public.${signature} from public, anon, authenticated;`)
        || deliverySql.includes(`revoke all on function public.${signature} from public, anon, authenticated;`),
      `missing revoke for ${signature}`,
    );
    assert.ok(
      quoteSql.includes(`grant execute on function public.${signature} to service_role;`)
        || deliverySql.includes(`grant execute on function public.${signature} to service_role;`),
      `missing service_role grant for ${signature}`,
    );
  }
});

test('canonical schema carries the quote columns and corporate delivery transitions', () => {
  assert.ok(canonicalSql.includes('add column if not exists accepted_quote_id uuid references public.corporate_quotes(id) on delete set null'));
  assert.ok(canonicalSql.includes('add column if not exists quoted_total numeric(12,2)'));
  assert.ok(canonicalSql.includes("v_is_corporate and old.status in ('payment_confirmed', 'preparing') and new.status = 'delivery_in_progress'"));
  assert.ok(canonicalSql.includes("v_is_corporate and old.status = 'delivered' and new.status in ('completed','refund_pending')"));
  assert.doesNotMatch(
    canonicalSql,
    /old\.status = 'payment_confirmed' and new\.status in \([^)]*delivery_in_progress/,
    'non-corporate orders must not gain the delivery shortcut',
  );
});
