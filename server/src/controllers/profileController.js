import { fetchEffectiveRoleData } from '../utils/effectiveRoles.js';
import { writeAudit } from '../utils/audit.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { getProfileById, resolveProfileUpdate, updateProfileById } from '../services/profileService.js';
import { normalizeProfilePatch } from '../validators/profileValidators.js';

function handleControllerError(res, err) {
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  if (err && err.code) {
    const mapped = mapDbError(err);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message, mapped.details);
  }
  return sendInternalError(res, err);
}

function requireUserId(req) {
  if (!req.user?.id) throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated user is required');
  return req.user.id;
}

/**
 * Build the handlers with injectable dependencies so the ownership and audit
 * rules can be tested without a live database. Express still receives the
 * plain named handlers exported below.
 */
export function createProfileController(dependencies = {}) {
  const {
    getProfileById: readProfile = getProfileById,
    resolveProfileUpdate: resolveUpdate = resolveProfileUpdate,
    updateProfileById: writeProfile = updateProfileById,
    fetchEffectiveRoleData: readEffectiveRoles = fetchEffectiveRoleData,
    writeAudit: auditWrite = writeAudit,
  } = dependencies;

  return {
    async getProfile(req, res) {
      try {
        const userId = requireUserId(req);
        const profile = await readProfile(userId);
        if (!profile) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

        return respond(req, res, { success: true, profile }, { cacheControl: 'no-store' });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async updateProfile(req, res) {
      try {
        const userId = requireUserId(req);
        const parsed = normalizeProfilePatch(req.body);
        if (parsed.errors?.length) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid profile update.', parsed.errors);
        }

        const currentProfile = await readProfile(userId);
        if (!currentProfile) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

        const resolved = await resolveUpdate(currentProfile, parsed.value);
        const changedFields = Object.keys(resolved);
        if (!changedFields.length) {
          return respond(req, res, { success: true, profile: currentProfile }, { cacheControl: 'no-store' });
        }

        const profile = await writeProfile(userId, resolved);
        if (!profile) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');

        await auditWrite(req, {
          action: 'UPDATE',
          tableName: 'public.profiles',
          recordKey: userId,
          newData: { changedFields },
          reason: 'Employee profile updated',
          category: 'data',
        });

        return respond(req, res, { success: true, profile }, { cacheControl: 'no-store' });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },

    async getProfileAccess(req, res) {
      try {
        const userId = requireUserId(req);
        const roleData = await readEffectiveRoles([userId]);
        const effective = roleData[userId] || {
          roles: [],
          platformRoles: [],
          vendorRoles: [],
          vendorMemberships: [],
        };

        return respond(req, res, {
          success: true,
          roles: effective.roles,
          platformRoles: effective.platformRoles,
          vendorRoles: effective.vendorRoles,
          vendorMemberships: effective.vendorMemberships,
        }, { cacheControl: 'no-store' });
      } catch (err) {
        return handleControllerError(res, err);
      }
    },
  };
}

const defaultController = createProfileController();

export const getProfile = defaultController.getProfile;
export const updateProfile = defaultController.updateProfile;
export const getProfileAccess = defaultController.getProfileAccess;
