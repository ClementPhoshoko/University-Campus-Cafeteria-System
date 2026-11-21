import { supabaseAdmin } from '../config/supabase.js';
import { sendNotificationEmail as defaultSendEmail } from './notificationEmail.js';
import { getProfileById as defaultGetProfile } from './profileService.js';
import {
  NOTIFICATION_COLUMNS,
  getEventDefinition,
  isNotificationEnabled,
  renderTemplate,
  resolveActionPath,
  sanitizeNotificationContext,
} from './notificationCatalog.js';

/**
 * Deterministic key for one (event, resource, channel) notification.
 *
 * Order-scoped events are identified only by the event key and order id. The
 * checkout flow, payment outcome, customer cancellation, vendor action and
 * email-resend endpoints all describe the same business event for one order,
 * so their caller hints must not create separate rows. The hint is kept only
 * for non-order resources such as a cart id, where it is the identity.
 */
export function buildDedupeKey({ eventKey, orderId = null, dedupeKey = null, channel = 'in_app' } = {}) {
  const resourceKey = orderId != null ? '' : (dedupeKey ?? '');
  return `${eventKey}:${orderId ?? 'none'}:${resourceKey}:${channel}`;
}

export function isUniqueViolation(error) {
  if (!error) return false;
  return error.code === '23505'
    || /duplicate key|unique constraint/i.test(error.message || '');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildEmailHtml({ title, body, actionPath }) {
  const link = actionPath
    ? `<p><a href="${escapeHtml(actionPath)}">View in Merchant Munchies</a></p>`
    : '';
  return `<div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p>${link}</div>`;
}

/** Find a row created by an earlier dispatch of the same event/channel. */
export async function findExistingNotification(db, userId, dedupeKeyValue) {
  if (!dedupeKeyValue) return null;
  const { data, error } = await db
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .eq('dedupe_key', dedupeKeyValue)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Insert a row, returning the pre-existing row when this event was already
 * dispatched. The lookup happens before the insert so idempotency does not
 * depend on the database index alone; the unique-violation path still covers
 * two concurrent dispatches racing between lookup and insert.
 */
export async function insertNotificationRow(db, payload) {
  const existing = await findExistingNotification(db, payload.user_id, payload.dedupe_key);
  if (existing) return { row: existing, duplicated: true };

  const { data, error } = await db
    .from('notifications')
    .insert(payload)
    .select(NOTIFICATION_COLUMNS)
    .maybeSingle();

  if (isUniqueViolation(error)) {
    const existing = await findExistingNotification(db, payload.user_id, payload.dedupe_key);
    if (existing) return { row: existing, duplicated: true };
  }
  if (error) throw error;
  return { row: data, duplicated: false };
}

/**
 * Dispatch a server-side event to one user. The in-app row is always written
 * first; email delivery is best-effort and can never fail the caller's
 * business operation.
 *
 * @param {object} params
 * @param {string} params.userId - authenticated profile id (never client input)
 * @param {string} params.eventKey - key from the central notification catalog
 * @param {string|null} [params.orderId]
 * @param {object} [params.context] - template values for this event
 * @param {string|null} [params.dedupeKey] - resource id for non-order events (e.g. cart id)
 * @param {object} [params.db] - Supabase client (defaults to the service role)
 * @param {object} [deps] - injectable { sendEmail, getProfile } for tests
 * @returns {Promise<null|{inApp: object, email: object|null, duplicate?: boolean, emailFailed?: boolean}>}
 *   null when suppressed by preferences or no profile exists.
 */
export async function dispatchNotification(
  { userId, eventKey, orderId = null, context = {}, dedupeKey = null, db = supabaseAdmin } = {},
  deps = {},
) {
  if (!userId || !eventKey) {
    throw new TypeError('dispatchNotification requires userId and eventKey');
  }

  const readProfile = deps.getProfile || defaultGetProfile;
  const send = deps.sendEmail || defaultSendEmail;

  const profile = await readProfile(userId, db);
  if (!profile) return null;

  const definition = getEventDefinition(eventKey);
  if (!isNotificationEnabled(profile.notification_preferences, eventKey)) return null;

  // Internal context still contains the order id for deep-link rendering and
  // template variables, but it must never leave the server in a DTO or email
  // context.
  const internalContext = {
    ...context,
    ...(orderId != null ? { orderId } : {}),
  };
  const storedContext = sanitizeNotificationContext(internalContext);
  const renderContext = {
    ...internalContext,
    userName: profile.full_name || profile.email?.split('@')[0] || 'there',
  };
  const title = renderTemplate(definition.titleTemplate, renderContext);
  const body = renderTemplate(definition.bodyTemplate, renderContext);
  const actionPath = resolveActionPath(definition, { orderId, context: internalContext });
  const now = new Date().toISOString();
  const metadata = {
    category: definition.category,
    level: definition.level,
    actionPath,
    context: storedContext,
  };

  const inAppResult = await insertNotificationRow(db, {
    user_id: userId,
    order_id: orderId,
    event_key: eventKey,
    channel: 'in_app',
    title,
    body,
    status: 'sent',
    sent_at: now,
    metadata,
    dedupe_key: buildDedupeKey({ eventKey, orderId, dedupeKey, channel: 'in_app' }),
  });

  // A duplicate event must not generate a second in-app row or a second email.
  if (inAppResult.duplicated) {
    return { inApp: inAppResult.row, email: null, duplicate: true };
  }

  if (!definition.channels.includes('email') || !profile.email) {
    return { inApp: inAppResult.row, email: null };
  }

  const emailDedupeKey = buildDedupeKey({ eventKey, orderId, dedupeKey, channel: 'email' });
  let emailSent = true;
  let failureReason = null;
  try {
    const result = await send({
      to: profile.email,
      subject: title,
      html: buildEmailHtml({ title, body, actionPath }),
      eventKey,
      context: storedContext,
      metadata,
    });
    if (result?.error) throw result.error;
  } catch (err) {
    emailSent = false;
    failureReason = err?.message || 'Email delivery failed';
    console.error('Notification email failed:', err);
  }

  // Recording the outcome is also best-effort: the business operation already
  // succeeded and must not be rolled back because of an audit row failure.
  try {
    const emailResult = await insertNotificationRow(db, {
      user_id: userId,
      order_id: orderId,
      event_key: eventKey,
      channel: 'email',
      title,
      body,
      status: emailSent ? 'sent' : 'failed',
      sent_at: emailSent ? now : null,
      failure_reason: failureReason,
      metadata,
      dedupe_key: emailDedupeKey,
    });
    return { inApp: inAppResult.row, email: emailResult.row, emailFailed: !emailSent };
  } catch (err) {
    console.error('Could not record notification email outcome:', err);
    return { inApp: inAppResult.row, email: null, emailFailed: !emailSent };
  }
}
