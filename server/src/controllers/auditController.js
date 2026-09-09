import { supabaseAdmin } from '../config/supabase.js';
import { sendInternalError } from '../utils/errors.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { respond, CACHE } from '../utils/http.js';

const ACTION_TYPES = { INSERT: 'create', UPDATE: 'update', DELETE: 'delete' };

function resourceName(tableName) {
  return String(tableName || '').replace(/^public\./, '').replaceAll('_', ' ');
}

export async function listAuditLogs(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) query = query.or(`action.ilike.%${search}%,table_name.ilike.%${search}%,record_key.ilike.%${search}%,reason.ilike.%${search}%`);
    if (req.query.action) query = query.eq('action', String(req.query.action).toUpperCase());
    if (req.query.table_name) query = query.eq('table_name', req.query.table_name);
    if (req.query.category) query = query.eq('category', req.query.category);
    if (req.query.actor_user_id) query = query.eq('actor_user_id', req.query.actor_user_id);
    if (req.query.from) query = query.gte('created_at', req.query.from);
    if (req.query.to) query = query.lte('created_at', req.query.to);

    const { data, error, count } = await query;
    if (error) throw error;

    // Server-side action counts (lightweight head-only queries per action)
    const baseFilters = (q) => {
      if (search) q = q.or(`action.ilike.%${search}%,table_name.ilike.%${search}%,record_key.ilike.%${search}%,reason.ilike.%${search}%`);
      if (req.query.table_name) q = q.eq('table_name', req.query.table_name);
      if (req.query.category) q = q.eq('category', req.query.category);
      if (req.query.actor_user_id) q = q.eq('actor_user_id', req.query.actor_user_id);
      if (req.query.from) q = q.gte('created_at', req.query.from);
      if (req.query.to) q = q.lte('created_at', req.query.to);
      return q;
    };

    const [insertCount, updateCount, deleteCount] = await Promise.all([
      baseFilters(supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'INSERT')),
      baseFilters(supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'UPDATE')),
      baseFilters(supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'DELETE')),
    ]);
    const action_counts = {
      INSERT: insertCount.count || 0,
      UPDATE: updateCount.count || 0,
      DELETE: deleteCount.count || 0,
    };

    const actorIds = [...new Set((data || []).map((row) => row.actor_user_id).filter(Boolean))];
    const actors = new Map();
    if (actorIds.length) {
      const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', actorIds);
      if (profileError) throw profileError;
      (profiles || []).forEach((profile) => actors.set(profile.id, profile));
    }

    const logs = (data || []).map((row) => {
      const actor = actors.get(row.actor_user_id);
      return {
        id: row.id,
        actor_user_id: row.actor_user_id,
        actor_name: actor?.full_name || actor?.email || 'System',
        actor_role: 'admin',
        action: row.action,
        action_type: ACTION_TYPES[row.action] || String(row.action || '').toLowerCase(),
        table_name: row.table_name,
        tableName: resourceName(row.table_name),
        resource_name: row.record_key || '—',
        record_key: row.record_key,
        old_data: row.old_data,
        new_data: row.new_data,
        created_at: row.created_at,
        createdAt: row.created_at,
        ip_address: row.ip_address,
        ipAddress: row.ip_address || '—',
        user_agent: row.user_agent,
        userAgent: row.user_agent || '—',
        reason: row.reason || null,
        category: row.category || null,
      };
    });

    return respond(req, res, { success: true, logs, action_counts, pagination: buildPagination(count, pageNum, limitNum) }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return sendInternalError(res, err);
  }
}
