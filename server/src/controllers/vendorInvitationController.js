import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from '../services/email/sendEmail.js';
import vendorInvitationEmail from '../services/email/templates/vendorInvitation.js';
import vendorJoinedEmail from '../services/email/templates/vendorJoined.js';
import { addSouthAfricanBusinessDays } from '../utils/businessDays.js';
import { ApiError, sendError, sendInternalError } from '../utils/errors.js';
import { writeAudit } from '../utils/audit.js';
import { respond } from '../utils/http.js';
import { isUuid } from '../validators/vendorValidators.js';

const db = () => supabaseAdmin;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function normalizeVendorInvitationInput(input = {}) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const role = input.role;
  const errors = [];
  if (
    email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) errors.push('Enter a valid email address');
  if (!['staff', 'manager'].includes(role)) errors.push('Role must be staff or manager');
  return errors.length ? { errors } : { value: { email, role } };
}

export function normalizeVendorStaffInvitationInput(input = {}) {
  return normalizeVendorInvitationInput({ email: input.email, role: 'staff' });
}

export function normalizeVendorInvitationRegistrationInput(input = {}) {
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = [];
  if (!fullName || fullName.length > 120) errors.push('Enter your name (up to 120 characters)');
  if (password.length < 8 || password.length > 128) errors.push('Password must be between 8 and 128 characters');
  return errors.length ? { errors } : { value: { fullName, password } };
}

function isExistingAuthUserError(error) {
  return error?.code === 'email_exists'
    || /already registered|already exists/i.test(error?.message || '');
}

function handleError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  if (error?.code === 'P0001') {
    const databaseErrors = {
      VENDOR_NOT_APPROVED: [409, 'VENDOR_NOT_APPROVED', 'Approve the vendor before inviting staff'],
      VENDOR_MANAGER_REQUIRED: [403, 'VENDOR_MANAGER_REQUIRED', 'A vendor manager role is required to invite staff'],
      MANAGER_ROLE_PROTECTED: [409, 'MANAGER_ROLE_PROTECTED', 'An existing vendor manager cannot be changed by a staff invitation'],
      MANAGER_INVITATION_EXISTS: [409, 'MANAGER_INVITATION_EXISTS', 'An administrator already has a pending manager invitation for this email'],
    };
    const mapped = databaseErrors[error.message];
    if (mapped) return sendError(res, ...mapped);
  }
  return sendInternalError(res, error);
}

function invitationFailure(data) {
  const responses = {
    NOT_FOUND: [404, 'INVITATION_NOT_FOUND', 'Invitation not found'],
    EXPIRED: [410, 'INVITATION_EXPIRED', 'This invitation has expired'],
    REVOKED: [410, 'INVITATION_REVOKED', 'This invitation has been revoked'],
    ACCEPTED: [410, 'INVITATION_ALREADY_USED', 'This invitation has already been used'],
    EMAIL_MISMATCH: [403, 'INVITATION_EMAIL_MISMATCH', 'This invitation is for another email address'],
    VENDOR_UNAVAILABLE: [410, 'VENDOR_UNAVAILABLE', 'This vendor is not currently accepting invitations'],
    MANAGER_ROLE_PROTECTED: [409, 'MANAGER_ROLE_PROTECTED', 'An existing vendor manager cannot accept a staff invitation'],
  };
  return responses[data?.code] || [409, 'INVITATION_UNAVAILABLE', 'This invitation is no longer available'];
}

async function sendJoinedConfirmation(email, invitation) {
  try {
    await sendEmail({
      to: email,
      subject: `You joined ${invitation.vendor_name} on Merchant Munchies`,
      html: vendorJoinedEmail({
        vendorName: invitation.vendor_name,
        role: invitation.role,
        loginUrl: new URL('/login', process.env.CLIENT_ORIGIN || 'http://localhost:5173').toString(),
      }),
    });
    return true;
  } catch (error) {
    console.error('Vendor invitation was accepted, but the joined confirmation email failed:', error);
    return false;
  }
}

function requireToken(req, res) {
  const token = req.params.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    sendError(res, 404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    return null;
  }
  return token;
}

async function redeemInvitation(token, userId, email) {
  const { data, error } = await db().rpc('redeem_vendor_invitation', {
    p_token_hash: hashToken(token),
    p_user_id: userId,
    p_email: email,
  });
  if (error) throw error;
  return data;
}

async function requireVendorManager(userId, vendorId) {
  const { data, error } = await db()
    .from('vendor_users')
    .select('role')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (data?.role !== 'manager') {
    throw new ApiError(403, 'VENDOR_MANAGER_REQUIRED', 'A vendor manager role is required to manage staff invitations');
  }
}

async function assertStaffInviteDoesNotTargetManager(vendorId, email) {
  const { data: profile, error: profileError } = await db()
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile) {
    const { data: membership, error: membershipError } = await db()
      .from('vendor_users')
      .select('role')
      .eq('user_id', profile.id)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (membership?.role === 'manager') {
      throw new ApiError(409, 'MANAGER_ROLE_PROTECTED', 'An existing vendor manager cannot be changed by a staff invitation');
    }
  }

  const { data: managerInvitation, error: invitationError } = await db()
    .from('vendor_invitations')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('email', email)
    .eq('role', 'manager')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (invitationError) throw invitationError;
  if (managerInvitation) {
    throw new ApiError(409, 'MANAGER_INVITATION_EXISTS', 'An administrator already has a pending manager invitation for this email');
  }
}

async function confirmInvitedUserEmail(token, userId) {
  const { data: invitedUsers, error: lookupError } = await db().rpc('get_invited_auth_user', {
    p_token_hash: hashToken(token),
  });
  if (lookupError) throw lookupError;
  const invitedUser = invitedUsers?.find((user) => user.user_id === userId);
  if (!invitedUser || invitedUser.email_confirmed_at) return Boolean(invitedUser);

  const { error: confirmError } = await db().auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (confirmError) throw confirmError;
  return true;
}

export async function listVendorInvitations(req, res) {
  try {
    const { vendorId } = req.params;
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor id');
    const { data, error } = await db()
      .from('vendor_invitations')
      .select('id, email, role, status, expires_at, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return respond(req, res, { success: true, invitations: data || [] }, { cacheControl: 'private, no-store' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listMyVendorInvitations(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor id');
    await requireVendorManager(req.user.id, vendorId);
    const { data, error } = await db()
      .from('vendor_invitations')
      .select('id, email, role, status, expires_at, created_at')
      .eq('vendor_id', vendorId)
      .eq('role', 'staff')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return respond(req, res, { success: true, invitations: data || [] }, { cacheControl: 'private, no-store' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createInvitation(req, vendorId, { email, role }, managerStaffOnly = false) {
  const { data: vendor, error: vendorError } = await db()
    .from('vendors')
    .select('name, status')
    .eq('id', vendorId)
    .maybeSingle();
  if (vendorError) throw vendorError;
  if (!vendor) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  if (vendor.status !== 'approved') throw new ApiError(409, 'VENDOR_NOT_APPROVED', 'Approve the vendor before inviting staff');

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = addSouthAfricanBusinessDays(new Date(), 3).toISOString();
  const inviteUrl = new URL(`/vendor-invitations/${token}`, process.env.CLIENT_ORIGIN || 'http://localhost:5173').toString();
  const invitation = { email, role, status: 'pending', expires_at: expiresAt };
  const emailHtml = vendorInvitationEmail({
    vendorName: vendor.name,
    role: invitation.role,
    inviteUrl,
    expiresAt,
  });
  const rpcArgs = {
    p_vendor_id: vendorId,
    p_email: email,
    p_created_by: req.user.id,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  };
  if (!managerStaffOnly) rpcArgs.p_role = role;
  const { data: invitationId, error: createError } = await db().rpc(
    managerStaffOnly ? 'create_vendor_staff_invitation' : 'create_vendor_invitation',
    rpcArgs,
  );
  if (createError) throw createError;
  invitation.id = invitationId;
  try {
    await sendEmail({
      to: invitation.email,
      subject: `Join ${vendor.name} on Merchant Munchies`,
      html: emailHtml,
    });
  } catch (emailError) {
    const { error: revokeError } = await db()
      .from('vendor_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitation.id)
      .eq('status', 'pending');
    if (revokeError) {
      console.error('Failed to revoke undelivered vendor invitation:', revokeError);
      console.error('Vendor invitation email delivery failed:', emailError);
      throw new ApiError(500, 'INVITATION_CLEANUP_FAILED', 'Email delivery failed and the invitation could not be revoked. Contact support before retrying.');
    }
    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.vendor_invitations',
      recordKey: invitation.id,
      oldData: { status: 'pending' },
      newData: { status: 'revoked' },
      reason: 'Invitation email delivery failed',
      category: 'access',
    });
    throw new ApiError(502, 'INVITATION_EMAIL_FAILED', 'The invitation could not be emailed. No active invitation was left behind; try again.');
  }
  return invitation;
}

export async function createVendorInvitation(req, res) {
  try {
    const { vendorId } = req.params;
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor id');
    const parsed = normalizeVendorInvitationInput(req.body);
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));
    const invitation = await createInvitation(req, vendorId, parsed.value);
    return respond(req, res, { success: true, invitation }, { status: 201 });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createMyVendorStaffInvitation(req, res) {
  try {
    const vendorId = String(req.body?.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor id');
    const parsed = normalizeVendorStaffInvitationInput(req.body);
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));
    await requireVendorManager(req.user.id, vendorId);
    await assertStaffInviteDoesNotTargetManager(vendorId, parsed.value.email);
    const invitation = await createInvitation(req, vendorId, parsed.value, true);
    return respond(req, res, { success: true, invitation }, { status: 201 });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function revokeMyVendorInvitation(req, res) {
  try {
    const { invitationId } = req.params;
    if (!isUuid(invitationId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid invitation id');
    const { data: existing, error: fetchError } = await db()
      .from('vendor_invitations')
      .select('vendor_id, role')
      .eq('id', invitationId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing || existing.role !== 'staff') {
      return sendError(res, 404, 'INVITATION_NOT_FOUND', 'Staff invitation not found');
    }
    await requireVendorManager(req.user.id, existing.vendor_id);
    req.params.vendorId = existing.vendor_id;
    return revokeVendorInvitation(req, res);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function revokeVendorInvitation(req, res) {
  try {
    const { vendorId, invitationId } = req.params;
    if (!isUuid(vendorId) || !isUuid(invitationId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor or invitation id');
    const { data: existing, error: fetchError } = await db()
      .from('vendor_invitations')
      .select('id, email, role, status, expires_at')
      .eq('id', invitationId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return sendError(res, 404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    if (existing.status !== 'pending') return sendError(res, 409, 'INVITATION_NOT_PENDING', 'Only pending invitations can be revoked');
    if (new Date(existing.expires_at) <= new Date()) {
      const { error } = await db().from('vendor_invitations').update({ status: 'expired' }).eq('id', invitationId).eq('status', 'pending');
      if (error) throw error;
      await writeAudit(req, {
        action: 'UPDATE',
        tableName: 'public.vendor_invitations',
        recordKey: invitationId,
        oldData: { status: 'pending' },
        newData: { status: 'expired' },
        reason: 'Vendor invitation expired',
        category: 'access',
      });
      return sendError(res, 409, 'INVITATION_EXPIRED', 'This invitation has expired');
    }

    const { data: invitation, error } = await db()
      .from('vendor_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      .eq('vendor_id', vendorId)
      .eq('status', 'pending')
      .select('id, email, role, status, expires_at, created_at')
      .maybeSingle();
    if (error) throw error;
    if (!invitation) return sendError(res, 409, 'INVITATION_NOT_PENDING', 'This invitation is no longer pending');

    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.vendor_invitations',
      recordKey: invitation.id,
      oldData: existing,
      newData: invitation,
      reason: 'Vendor invitation revoked',
      category: 'access',
    });
    return respond(req, res, { success: true, invitation });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getPublicVendorInvitation(req, res) {
  try {
    const token = requireToken(req, res);
    if (!token) return;
    const { data, error } = await db()
      .from('vendor_invitations')
      .select('id, email, role, status, expires_at, vendors!inner(name, status)')
      .eq('token_hash', hashToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    if (data.status === 'pending' && new Date(data.expires_at) <= new Date()) {
      const { error: updateError } = await db().from('vendor_invitations').update({ status: 'expired' }).eq('id', data.id).eq('status', 'pending');
      if (updateError) throw updateError;
      data.status = 'expired';
      await writeAudit(req, {
        action: 'UPDATE',
        tableName: 'public.vendor_invitations',
        recordKey: data.id,
        oldData: { status: 'pending' },
        newData: { status: 'expired' },
        reason: 'Vendor invitation expired',
        category: 'access',
      });
    }
    if (data.status !== 'pending') {
      return sendError(res, 410, `INVITATION_${data.status.toUpperCase()}`, `This invitation is ${data.status}`);
    }
    if (data.vendors.status !== 'approved') {
      return sendError(res, 410, 'VENDOR_UNAVAILABLE', 'This vendor is not currently accepting invitations');
    }
    return respond(req, res, {
      success: true,
      invitation: {
        vendor_name: data.vendors.name,
        email: data.email,
        role: data.role,
        expires_at: data.expires_at,
      },
    }, { cacheControl: 'no-store' });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function acceptVendorInvitation(req, res) {
  try {
    const token = requireToken(req, res);
    if (!token) return;
    if (!req.user.email_confirmed_at) {
      const emailConfirmedByInvitation = await confirmInvitedUserEmail(token, req.user.id);
      if (!emailConfirmedByInvitation) {
        return sendError(res, 403, 'EMAIL_VERIFICATION_REQUIRED', 'This invitation cannot verify the signed-in account email');
      }
    }
    const data = await redeemInvitation(token, req.user.id, req.user.email || '');
    if (!data?.success) {
      const [status, code, message] = invitationFailure(data);
      return sendError(res, status, code, message);
    }
    const confirmationEmailSent = await sendJoinedConfirmation(req.user.email, data);
    return respond(req, res, {
      success: true,
      invitation: data,
      confirmation_email_sent: confirmationEmailSent,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function registerAndAcceptVendorInvitation(req, res) {
  try {
    const token = requireToken(req, res);
    if (!token) return;
    const parsed = normalizeVendorInvitationRegistrationInput(req.body);
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));

    const { data: invitation, error: invitationError } = await db()
      .from('vendor_invitations')
      .select('id, email, role, status, expires_at, vendors!inner(name, status)')
      .eq('token_hash', hashToken(token))
      .maybeSingle();
    if (invitationError) throw invitationError;
    if (!invitation) return sendError(res, 404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    if (invitation.status !== 'pending') {
      const [status, code, message] = invitationFailure({ code: invitation.status.toUpperCase() });
      return sendError(res, status, code, message);
    }
    if (new Date(invitation.expires_at) <= new Date()) {
      const { error: updateError } = await db()
        .from('vendor_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
        .eq('status', 'pending');
      if (updateError) throw updateError;
      await writeAudit(req, {
        action: 'UPDATE',
        tableName: 'public.vendor_invitations',
        recordKey: invitation.id,
        oldData: { status: 'pending' },
        newData: { status: 'expired' },
        reason: 'Vendor invitation expired during registration',
        category: 'access',
      });
      return sendError(res, 410, 'INVITATION_EXPIRED', 'This invitation has expired');
    }
    if (invitation.vendors.status !== 'approved') {
      return sendError(res, 410, 'VENDOR_UNAVAILABLE', 'This vendor is not currently accepting invitations');
    }

    // The single-use link was delivered to this mailbox and is the verification proof.
    const { data: created, error: createError } = await db().auth.admin.createUser({
      email: invitation.email,
      password: parsed.value.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.value.fullName },
    });
    if (createError) {
      if (isExistingAuthUserError(createError)) {
        const { data: invitedUsers, error: lookupError } = await db().rpc('get_invited_auth_user', {
          p_token_hash: hashToken(token),
        });
        if (lookupError) throw lookupError;
        const existingUser = invitedUsers?.[0];
        if (existingUser && !existingUser.email_confirmed_at) {
          const { error: confirmError } = await db().auth.admin.updateUserById(existingUser.user_id, {
            email_confirm: true,
          });
          if (confirmError) throw confirmError;
        }
        return sendError(res, 409, 'ACCOUNT_EXISTS', 'An account already uses this email. Sign in to accept the invitation.');
      }
      throw createError;
    }
    if (!created?.user?.id) throw new Error('Supabase did not return the created invitation account');

    const accepted = await redeemInvitation(token, created.user.id, created.user.email || invitation.email);
    if (!accepted?.success) {
      const [status, code, message] = invitationFailure(accepted);
      const { error: deleteError } = await db().auth.admin.deleteUser(created.user.id);
      if (deleteError) {
        console.error('Failed to remove account created for an invitation that could not be redeemed:', deleteError);
      }
      return sendError(res, status, code, message);
    }

    const confirmationEmailSent = await sendJoinedConfirmation(invitation.email, accepted);
    return respond(req, res, {
      success: true,
      invitation: accepted,
      confirmation_email_sent: confirmationEmailSent,
    }, { status: 201 });
  } catch (error) {
    return handleError(res, error);
  }
}
