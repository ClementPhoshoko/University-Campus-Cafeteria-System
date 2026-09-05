import { supabaseAdmin } from '../config/supabase.js';

/**
 * Insert an explicit audit_logs row for a service-role mutation.
 * The DB `audit_row_change` trigger records a NULL actor for service-role
 * writes (auth.uid() is null), so controllers must attribute explicitly
 * with the authenticated admin's id (plan §7).
 */
export async function writeAudit(req, { action, tableName, recordKey, newData, oldData } = {}) {
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
    });
  } catch (err) {
    console.error('writeAudit failed:', err);
  }
}