import { supabaseAdmin } from '../config/supabase.js';

/**
 * Insert an explicit audit_logs row for a service-role mutation.
 * The DB `audit_row_change` trigger records a NULL actor for service-role
 * writes (auth.uid() is null), so controllers must attribute explicitly
 * with the authenticated admin's id (plan §7).
 *
 * @param {object} req - Express request (provides user, ip, user-agent)
 * @param {object} opts
 * @param {string} opts.action     - INSERT | UPDATE | DELETE
 * @param {string} opts.tableName  - fully-qualified table (e.g. 'public.vendors')
 * @param {string} opts.recordKey  - primary key value
 * @param {object} [opts.oldData]  - row state before mutation
 * @param {object} [opts.newData]  - row state after mutation
 * @param {string} [opts.reason]   - human-readable reason for the change
 * @param {string} [opts.category] - domain: data | access | config | lifecycle
 */
export async function writeAudit(req, { action, tableName, recordKey, oldData, newData, reason, category } = {}) {
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: req.user?.id || null,
      action,
      table_name: tableName,
      record_key: recordKey != null ? String(recordKey) : null,
      old_data: oldData || null,
      new_data: newData || null,
      ip_address: req.ip || null,
      user_agent: (req.get && req.get('user-agent')) || null,
      reason: reason || null,
      category: category || null,
    });
  } catch (err) {
    console.error('writeAudit failed:', err);
  }
}