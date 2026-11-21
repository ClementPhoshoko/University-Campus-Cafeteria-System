import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { writeAudit } from '../utils/audit.js';
import { getProfileById, updateProfileById } from '../services/profileService.js';
import {
  NOTIFICATION_COLUMNS,
  deriveUnreadLevel,
  resolveNotificationPreferences,
  toNotificationDto,
  validateNotificationFilter,
} from '../services/notificationCatalog.js';
import {
  mergeNotificationPreferences,
  normalizeProfilePatch,
} from '../validators/profileValidators.js';

const NOTIFICATIONS_TABLE = 'public.notifications';
const PROFILES_TABLE = 'public.profiles';

function handleControllerError(res, err) {
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  if (err && err.code) {
    const mapped = mapDbError(err);
    if (mapped) {
      const notConfigured = ['42P01', 'PGRST205'].includes(err.code);
      return sendError(
        res,
        notConfigured ? 503 : mapped.status,
        notConfigured ? 'NOTIFICATIONS_NOT_CONFIGURED' : mapped.code,
        notConfigured
          ? 'Notifications are not configured in this environment. Apply migration 034.'
          : mapped.message,
      );
    }
  }
  return sendInternalError(res, err);
}

function requireUserId(req) {
  if (!req.user?.id) throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated user is required');
  return req.user.id;
}

/** Auditing is useful but must never turn a successful mutation into a 500. */
async function auditSafely(auditWrite, req, options) {
  try {
    await auditWrite(req, options);
  } catch (err) {
    console.error('Notification audit failed:', err);
  }
}

function notificationNotFoundError() {
  return new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
}

function preferencesResponse(profile, merged) {
  return {
    success: true,
    preferences: resolveNotificationPreferences(profile?.notification_preferences ?? merged),
  };
}

/**
 * Handlers are built with injectable dependencies for tests. Express always
 * receives the plain `(req, res)` exports at the bottom of this module.
 */
export function createNotificationController(dependencies = {}) {
  const {
    db: injectedDb = supabaseAdmin,
    getProfile: readProfile = getProfileById,
    updateProfile: writeProfile = updateProfileById,
    writeAudit: auditWrite = writeAudit,
  } = dependencies;

  return {
    async getNotifications(req, res) {
      try {
        const userId = requireUserId(req);
        const filter = validateNotificationFilter(req.query?.filter);
        if (!filter) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification filter.', [
            'filter must be one of all, unread, read',
          ]);
        }

        const { pageNum, limitNum, from, to } = parsePagination(req.query || {});
        const eventKey = req.query?.eventKey || null;
        const orderId = req.query?.orderId || null;

        let listQuery = injectedDb
          .from('notifications')
          .select(NOTIFICATION_COLUMNS, { count: 'exact' })
          .eq('user_id', userId);

        if (filter === 'unread') listQuery = listQuery.is('read_at', null);
        if (filter === 'read') listQuery = listQuery.not('read_at', 'is', null);
        if (eventKey) listQuery = listQuery.eq('event_key', eventKey);
        if (orderId) listQuery = listQuery.eq('order_id', orderId);

        const [listResult, unreadResult] = await Promise.all([
          listQuery
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to),
          injectedDb
            .from('notifications')
            .select('id, event_key, read_at')
            .eq('user_id', userId)
            .is('read_at', null),
        ]);

        if (listResult.error) throw listResult.error;
        if (unreadResult.error) throw unreadResult.error;

        const unreadRows = unreadResult.data || [];
        return respond(req, res, {
          success: true,
          notifications: (listResult.data || []).map(toNotificationDto),
          unreadCount: unreadRows.length,
          level: deriveUnreadLevel(unreadRows),
          pagination: buildPagination(listResult.count, pageNum, limitNum),
        }, { cacheControl: 'no-store' });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async getUnreadCount(req, res) {
      try {
        const userId = requireUserId(req);
        const { data, error } = await injectedDb
          .from('notifications')
          .select('id, event_key, read_at')
          .eq('user_id', userId)
          .is('read_at', null);
        if (error) throw error;

        const rows = data || [];
        return respond(req, res, {
          success: true,
          unreadCount: rows.length,
          level: deriveUnreadLevel(rows),
        }, { cacheControl: 'no-store' });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async markNotificationRead(req, res) {
      try {
        const userId = requireUserId(req);
        const notificationId = req.params?.notificationId;
        if (!notificationId) throw notificationNotFoundError();

        const { data: existing, error: lookupError } = await injectedDb
          .from('notifications')
          .select(NOTIFICATION_COLUMNS)
          .eq('id', notificationId)
          .eq('user_id', userId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!existing) throw notificationNotFoundError();

        if (existing.read_at) {
          return respond(req, res, { success: true, notification: toNotificationDto(existing) });
        }

        const patch = { status: 'read', read_at: new Date().toISOString() };
        const { data, error } = await injectedDb
          .from('notifications')
          .update(patch)
          .eq('id', notificationId)
          .eq('user_id', userId)
          .select(NOTIFICATION_COLUMNS)
          .maybeSingle();
        if (error) throw error;

        const updated = data || { ...existing, ...patch };
        await auditSafely(auditWrite, req, {
          action: 'UPDATE',
          tableName: NOTIFICATIONS_TABLE,
          recordKey: notificationId,
          newData: { status: 'read', read_at: patch.read_at },
          reason: 'Notification marked read',
          category: 'data',
        });

        return respond(req, res, { success: true, notification: toNotificationDto(updated) });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async markNotificationUnread(req, res) {
      try {
        const userId = requireUserId(req);
        const notificationId = req.params?.notificationId;
        if (!notificationId) throw notificationNotFoundError();

        const { data: existing, error: lookupError } = await injectedDb
          .from('notifications')
          .select(NOTIFICATION_COLUMNS)
          .eq('id', notificationId)
          .eq('user_id', userId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!existing) throw notificationNotFoundError();

        if (!existing.read_at) {
          return respond(req, res, { success: true, notification: toNotificationDto(existing) });
        }

        const patch = { status: 'sent', read_at: null };
        const { data, error } = await injectedDb
          .from('notifications')
          .update(patch)
          .eq('id', notificationId)
          .eq('user_id', userId)
          .select(NOTIFICATION_COLUMNS)
          .maybeSingle();
        if (error) throw error;

        const updated = data || { ...existing, ...patch };
        await auditSafely(auditWrite, req, {
          action: 'UPDATE',
          tableName: NOTIFICATIONS_TABLE,
          recordKey: notificationId,
          newData: patch,
          reason: 'Notification marked unread',
          category: 'data',
        });

        return respond(req, res, { success: true, notification: toNotificationDto(updated) });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async deleteNotification(req, res) {
      try {
        const userId = requireUserId(req);
        const notificationId = req.params?.notificationId;
        if (!notificationId) throw notificationNotFoundError();

        const { data: existing, error: lookupError } = await injectedDb
          .from('notifications')
          .select(NOTIFICATION_COLUMNS)
          .eq('id', notificationId)
          .eq('user_id', userId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!existing) throw notificationNotFoundError();

        const { error } = await injectedDb
          .from('notifications')
          .delete()
          .eq('id', notificationId)
          .eq('user_id', userId);
        if (error) throw error;

        await auditSafely(auditWrite, req, {
          action: 'DELETE',
          tableName: NOTIFICATIONS_TABLE,
          recordKey: notificationId,
          oldData: { event_key: existing.event_key, channel: existing.channel },
          reason: 'Notification deleted',
          category: 'data',
        });

        return respond(req, res, { success: true });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async markAllNotificationsRead(req, res) {
      try {
        const userId = requireUserId(req);
        const patch = { status: 'read', read_at: new Date().toISOString() };
        const { data, error } = await injectedDb
          .from('notifications')
          .update(patch)
          .eq('user_id', userId)
          .is('read_at', null)
          .select('id');
        if (error) throw error;

        const updated = (data || []).length;
        await auditSafely(auditWrite, req, {
          action: 'UPDATE',
          tableName: NOTIFICATIONS_TABLE,
          recordKey: userId,
          newData: { updated, read_at: patch.read_at },
          reason: 'All notifications marked read',
          category: 'data',
        });

        return respond(req, res, { success: true, updated });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async clearReadNotifications(req, res) {
      try {
        const userId = requireUserId(req);
        const { data, error } = await injectedDb
          .from('notifications')
          .delete()
          .eq('user_id', userId)
          .not('read_at', 'is', null)
          .select('id');
        if (error) throw error;

        const deleted = (data || []).length;
        await auditSafely(auditWrite, req, {
          action: 'DELETE',
          tableName: NOTIFICATIONS_TABLE,
          recordKey: userId,
          newData: { deleted },
          reason: 'Read notifications cleared',
          category: 'data',
        });

        return respond(req, res, { success: true, deleted });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async getNotificationPreferences(req, res) {
      try {
        const userId = requireUserId(req);
        const profile = await readProfile(userId, injectedDb);
        if (!profile) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
        return respond(req, res, preferencesResponse(profile), { cacheControl: 'no-store' });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async updateNotificationPreferences(req, res) {
      try {
        const userId = requireUserId(req);
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification preferences.', [
            'Request body must be an object.',
          ]);
        }

        // Accept both the flat alias body and the canonical nested profile
        // shape, but validate either form through the profile allowlist so
        // `transactional` and unknown keys can never be written here.
        const wrapped = 'notification_preferences' in body
          ? (Object.keys(body).length === 1
            ? body
            : null)
          : { notification_preferences: body };
        if (!wrapped) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification preferences.', [
            'notification_preferences cannot be mixed with other profile fields.',
          ]);
        }

        const parsed = normalizeProfilePatch(wrapped);
        if (parsed.errors?.length) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification preferences.', parsed.errors);
        }
        if (!parsed.value.notification_preferences) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid notification preferences.', [
            'At least one editable preference is required.',
          ]);
        }

        const currentProfile = await readProfile(userId, injectedDb);
        if (!currentProfile) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

        const merged = mergeNotificationPreferences(
          currentProfile.notification_preferences,
          parsed.value.notification_preferences,
        );
        const profile = await writeProfile(userId, { notification_preferences: merged }, injectedDb);

        await auditSafely(auditWrite, req, {
          action: 'UPDATE',
          tableName: PROFILES_TABLE,
          recordKey: userId,
          newData: { changedFields: ['notification_preferences'] },
          reason: 'Notification preferences updated',
          category: 'data',
        });

        return respond(req, res, preferencesResponse(profile || { notification_preferences: merged }, merged));
      } catch (err) {
        return handleControllerError(res, err);
      }
    },
  };
}

const defaultController = createNotificationController();

export const getNotifications = defaultController.getNotifications;
export const getUnreadCount = defaultController.getUnreadCount;
export const markNotificationRead = defaultController.markNotificationRead;
export const markNotificationUnread = defaultController.markNotificationUnread;
export const deleteNotification = defaultController.deleteNotification;
export const markAllNotificationsRead = defaultController.markAllNotificationsRead;
export const clearReadNotifications = defaultController.clearReadNotifications;
export const getNotificationPreferences = defaultController.getNotificationPreferences;
export const updateNotificationPreferences = defaultController.updateNotificationPreferences;

// Injectable variants used by the test suite. Express handlers above never
// accept a database client argument.
export const getNotificationsWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).getNotifications(req, res);
export const getUnreadCountWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).getUnreadCount(req, res);
export const markNotificationReadWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).markNotificationRead(req, res);
export const markNotificationUnreadWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).markNotificationUnread(req, res);
export const deleteNotificationWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).deleteNotification(req, res);
export const markAllNotificationsReadWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).markAllNotificationsRead(req, res);
export const clearReadNotificationsWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).clearReadNotifications(req, res);
export const getNotificationPreferencesWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).getNotificationPreferences(req, res);
export const updateNotificationPreferencesWithDb = (req, res, dbClient) => createNotificationController({ db: dbClient }).updateNotificationPreferences(req, res);
