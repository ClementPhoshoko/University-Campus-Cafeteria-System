const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

export const VENDOR_SORTS = ['name', 'created_at', 'average_rating'];
export const VENDOR_STATUSES = ['pending', 'approved', 'suspended', 'inactive', 'rejected'];
export const SERVICE_STATUSES = ['open', 'closed', 'busy', 'temporarily_unavailable'];
export const MEMBER_ROLES = ['staff', 'manager'];
export const APPROVAL_DECISIONS = ['approve', 'reject', 'suspend', 'activate'];

/**
 * Legal vendor-status transitions for PATCH /admin/vendors/:id/approval.
 * `requiresLocation` = must hold >= 1 active location to end approved.
 * `requiresReason` = body must include a reason string.
 */
export const APPROVAL_TRANSITIONS = {
  approve: { from: ['pending', 'inactive', 'suspended', 'rejected'], to: 'approved', requiresLocation: true },
  activate: { from: ['suspended', 'rejected', 'inactive', 'pending'], to: 'approved', requiresLocation: true },
  suspend: { from: ['approved'], to: 'suspended' },
  reject: { from: ['pending', 'inactive', 'suspended', 'approved'], to: 'rejected', requiresReason: true },
};

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function slugify(name) {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Field normalisers
// ---------------------------------------------------------------------------

function text(input, key, { max = 255, required = false, pattern = null, allowEmptyToNull = false } = {}) {
  if (input[key] === undefined || input[key] === null) {
    if (required) return { error: `${key} is required` };
    return { skip: true };
  }
  if (typeof input[key] !== 'string') return { error: `${key} must be a string` };
  const value = input[key].trim();
  if (value === '') {
    if (required) return { error: `${key} is required` };
    return { value: allowEmptyToNull ? null : '' };
  }
  if (value.length > max) return { error: `${key} must be ${max} characters or fewer` };
  if (pattern && !pattern.test(value)) return { error: `${key} contains invalid characters` };
  return { value };
}

function email(input, key, { allowEmptyToNull = true } = {}) {
  const result = text(input, key, { max: 255, allowEmptyToNull });
  if (result.error) return result;
  if (result.skip || result.value == null || result.value === '') return result;
  if (!EMAIL_RE.test(result.value)) return { error: `${key} must be a valid email address` };
  return result;
}

function integer(input, key, { min = null, max = null, required = false } = {}) {
  if (input[key] === undefined || input[key] === null || input[key] === '') {
    if (required) return { error: `${key} is required` };
    return { skip: true };
  }
  if (typeof input[key] === 'boolean') return { error: `${key} must be an integer` };
  const num = Number(input[key]);
  if (!Number.isInteger(num)) return { error: `${key} must be an integer` };
  if (min !== null && num < min) return { error: `${key} must be at least ${min}` };
  if (max !== null && num > max) return { error: `${key} must be at most ${max}` };
  return { value: num };
}

function boolean(input, key, { dflt } = {}) {
  if (input[key] === undefined || input[key] === null) {
    if (dflt !== undefined) return { value: dflt };
    return { skip: true };
  }
  if (typeof input[key] !== 'boolean') return { error: `${key} must be a boolean` };
  return { value: input[key] };
}

function uuid(input, key, { nullable = false, required = false } = {}) {
  if (input[key] === undefined || input[key] === null || input[key] === '') {
    if (required) return { error: `${key} is required` };
    if (nullable) return { value: null };
    return { skip: true };
  }
  if (!isUuid(input[key])) return { error: `${key} must be a valid UUID` };
  return { value: input[key] };
}

function enumValue(input, key, { values, required = false, dflt } = {}) {
  if (input[key] === undefined || input[key] === null || input[key] === '') {
    if (required) return { error: `${key} is required` };
    if (dflt !== undefined) return { value: dflt };
    return { skip: true };
  }
  if (!values.includes(input[key])) return { error: `${key} must be one of: ${values.join(', ')}` };
  return { value: input[key] };
}

// ---------------------------------------------------------------------------
// Entity normalisers
// ---------------------------------------------------------------------------

export function normalizeVendor(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  const name = text(input, 'name', { required: !partial, max: 120 });
  if (name.error) errors.push(name.error); else if (name.value !== undefined && !name.skip) value.name = name.value;

  const description = text(input, 'description', { max: 2000, allowEmptyToNull: true });
  if (description.error) errors.push(description.error); else if (description.value !== undefined && !description.skip) value.description = description.value;

  const logo = text(input, 'logo_url', { max: 500, allowEmptyToNull: true });
  if (logo.error) errors.push(logo.error); else if (logo.value !== undefined && !logo.skip) value.logo_url = logo.value;

  const supportEmail = email(input, 'support_email');
  if (supportEmail.error) errors.push(supportEmail.error); else if (supportEmail.value !== undefined && !supportEmail.skip) value.support_email = supportEmail.value;

  const supportPhone = text(input, 'support_phone', { max: 30, allowEmptyToNull: true });
  if (supportPhone.error) errors.push(supportPhone.error); else if (supportPhone.value !== undefined && !supportPhone.skip) value.support_phone = supportPhone.value;

  const catering = boolean(input, 'corporate_catering_enabled', { dflt: !partial ? false : undefined });
  if (catering.error) errors.push(catering.error); else if (catering.value !== undefined && !catering.skip) value.corporate_catering_enabled = catering.value;

  if (!partial) {
    const onboardingKey = text(input, 'onboarding_key', { max: 100, allowEmptyToNull: true });
    if (onboardingKey.error) errors.push(onboardingKey.error);
    else if (onboardingKey.value !== undefined && !onboardingKey.skip) value.onboarding_key = onboardingKey.value || null;
  }

  if (errors.length) return { errors };
  if (Object.keys(value).length === 0) return { value, empty: true };
  return { value };
}

export function normalizeVendorLocation(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  const siteId = uuid(input, 'site_id', { required: !partial });
  if (siteId.error) errors.push(siteId.error); else if (siteId.value !== undefined && !siteId.skip) value.site_id = siteId.value;

  const buildingId = uuid(input, 'building_id', { required: !partial });
  if (buildingId.error) errors.push(buildingId.error); else if (buildingId.value !== undefined && !buildingId.skip) value.building_id = buildingId.value;

  const pointId = uuid(input, 'collection_point_id', { nullable: true });
  if (pointId.error) errors.push(pointId.error); else if (pointId.value !== undefined && !pointId.skip) value.collection_point_id = pointId.value;

  const status = enumValue(input, 'service_status', { values: SERVICE_STATUSES, dflt: !partial ? 'closed' : undefined });
  if (status.error) errors.push(status.error); else if (status.value !== undefined && !status.skip) value.service_status = status.value;

  const cutoff = integer(input, 'order_cutoff_minutes', { min: 0 });
  if (cutoff.error) errors.push(cutoff.error); else if (cutoff.value !== undefined && !cutoff.skip) value.order_cutoff_minutes = cutoff.value;

  const prep = integer(input, 'estimated_prep_minutes', { min: 1 });
  if (prep.error) errors.push(prep.error); else if (prep.value !== undefined && !prep.skip) value.estimated_prep_minutes = prep.value;

  const instructions = text(input, 'collection_instructions', { max: 1000, allowEmptyToNull: true });
  if (instructions.error) errors.push(instructions.error); else if (instructions.value !== undefined && !instructions.skip) value.collection_instructions = instructions.value;

  const active = boolean(input, 'is_active');
  if (active.error) errors.push(active.error); else if (active.value !== undefined && !active.skip) value.is_active = active.value;

  if (errors.length) return { errors };
  if (Object.keys(value).length === 0) return { value, empty: true };
  return { value };
}

/**
 * hours: array of { day_of_week, opens_at?, closes_at?, is_closed? }
 * day_of_week is 0 (Sunday) .. 6 (Saturday).
 */
export function normalizeOperatingHours(list) {
  if (!Array.isArray(list)) return { errors: ['hours must be an array'] };
  if (list.length === 0) return { value: [] };

  const errors = [];
  const value = [];

  for (const row of list) {
    if (!row || typeof row !== 'object') {
      errors.push('each hours entry must be an object');
      break;
    }

    const entry = {};
    const day = integer(row, 'day_of_week', { min: 0, max: 6, required: true });
    if (day.error) {
      errors.push(`hours day_of_week ${day.error}`);
      break;
    }
    entry.day_of_week = day.value;

    const closed = boolean(row, 'is_closed', { dflt: false });
    if (closed.error) {
      errors.push(`hours[${entry.day_of_week}].${closed.error}`);
      break;
    }
    entry.is_closed = closed.value;

    const opensAt = text(row, 'opens_at', { max: 8 });
    if (opensAt.error) {
      errors.push(`hours[${entry.day_of_week}].${opensAt.error}`);
      break;
    }
    if (opensAt.value) {
      if (!TIME_RE.test(opensAt.value)) {
        errors.push(`hours[${entry.day_of_week}].opens_at must be HH:MM[:SS]`);
        break;
      }
      entry.opens_at = opensAt.value;
    }

    const closesAt = text(row, 'closes_at', { max: 8 });
    if (closesAt.error) {
      errors.push(`hours[${entry.day_of_week}].${closesAt.error}`);
      break;
    }
    if (closesAt.value) {
      if (!TIME_RE.test(closesAt.value)) {
        errors.push(`hours[${entry.day_of_week}].closes_at must be HH:MM[:SS]`);
        break;
      }
      entry.closes_at = closesAt.value;
    }

    if (!entry.is_closed && (entry.opens_at === undefined || entry.closes_at === undefined)) {
      errors.push(`hours day ${entry.day_of_week}: opens_at and closes_at are required when not is_closed`);
      break;
    }

    value.push(entry);
  }

  if (errors.length) return { errors };

  const days = new Set(value.map((v) => v.day_of_week));
  if (days.size !== value.length) return { errors: ['hours contains duplicate day_of_week entries'] };

  return { value };
}

export function normalizeApproval(input) {
  const errors = [];
  const decision = enumValue(input, 'decision', { values: APPROVAL_DECISIONS, required: true });
  if (decision.error) errors.push(decision.error);

  const reason = text(input, 'reason', { max: 500, allowEmptyToNull: true });
  if (reason.error) errors.push(reason.error);

  const value = {};
  if (decision.value !== undefined && !decision.skip) value.decision = decision.value;
  if (reason.value !== undefined && !reason.skip) value.reason = reason.value || null;

  // Rejecting a vendor must always be attributable (plan §5.4, §7).
  if (value.decision === 'reject' && !value.reason) {
    errors.push('reason is required when rejecting a vendor');
  }

  if (errors.length) return { errors };
  return { value };
}

export function normalizeVendorUser(input) {
  const errors = [];
  const value = {};
  const hasUserId = input.user_id !== undefined && input.user_id !== null && input.user_id !== '';
  const hasEmail = input.email !== undefined && input.email !== null && input.email !== '';

  if (hasUserId && hasEmail) {
    errors.push('provide either user_id or email, not both');
  } else if (hasUserId) {
    const userId = uuid(input, 'user_id', { required: true });
    if (userId.error) errors.push(userId.error); else value.user_id = userId.value;
  } else if (hasEmail) {
    const mail = email(input, 'email', { allowEmptyToNull: false });
    if (mail.error) errors.push(mail.error); else value.email = mail.value;
  } else {
    errors.push('user_id or email is required');
  }

  const role = enumValue(input, 'role', { values: MEMBER_ROLES, dflt: 'staff' });
  if (role.error) errors.push(role.error); else if (role.value !== undefined && !role.skip) value.role = role.value;

  if (errors.length) return { errors };
  return { value };
}