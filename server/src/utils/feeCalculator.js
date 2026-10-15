import { supabaseAdmin } from '../config/supabase.js';

const DEFAULT_SERVICE_FEE_PERCENTAGE = 5;

export function selectApplicableFeeRule(rules, { siteId, vendorLocationId, now = new Date() }) {
  const applicable = (rules || []).filter((rule) => {
    if (rule.currency && rule.currency.trim() !== 'ZAR') return false;
    if (new Date(rule.active_from) > now) return false;
    if (rule.active_until && new Date(rule.active_until) <= now) return false;
    if (rule.scope === 'vendor_location') return rule.vendor_location_id === vendorLocationId;
    if (rule.scope === 'site') return rule.site_id === siteId;
    return rule.scope === 'platform';
  });

  applicable.sort((a, b) => {
    const specificity = { platform: 0, site: 1, vendor_location: 2 };
    return (specificity[b.scope] - specificity[a.scope])
      || (Number(b.priority) - Number(a.priority))
      || (new Date(b.active_from) - new Date(a.active_from));
  });

  return applicable[0] || null;
}

export function calculateFeeAmount(subtotal, rule) {
  if (subtotal <= 0) return 0;
  const rawFee = rule
    ? rule.calculation_type === 'fixed'
      ? Number(rule.amount)
      : (subtotal * Number(rule.amount)) / 100
    : (subtotal * DEFAULT_SERVICE_FEE_PERCENTAGE) / 100;
  return Math.round((rawFee + Number.EPSILON) * 100) / 100;
}

export async function calculateServiceFee(subtotal, { siteId, vendorLocationId } = {}) {
  const now = new Date();
  const { data: rules, error } = await supabaseAdmin
    .from('fee_rules')
    .select('scope, site_id, vendor_location_id, calculation_type, amount, currency, priority, active_from, active_until')
    .eq('fee_type', 'service_fee')
    .eq('is_active', true)
    .lte('active_from', now.toISOString());
  if (error) throw error;

  const rule = selectApplicableFeeRule(rules, { siteId, vendorLocationId, now });
  return calculateFeeAmount(subtotal, rule);
}
