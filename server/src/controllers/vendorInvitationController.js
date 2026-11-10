import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from '../services/email/sendEmail.js';
import vendorInvitationEmail from '../services/email/templates/vendorInvitation.js';
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

function handleError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  if (error?.code === 'P0001' && error.message === 'VENDOR_NOT_APPROVED') {
    return sendError(res, 409, 'VENDOR_NOT_APPROVED', 'Approve the vendor before inviting staff');
  }
  return sendInternalError(res, error);
}

function requireToken(req, res) {
  const token = req.params.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    sendError(res, 404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    return null;
  }
  return token;
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

export async function createVendorInvitation(req, res) {
  try {
    const { vendorId } = req.params;
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor id');
    const parsed = normalizeVendorInvitationInput(req.body);
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));

    const { data: vendor, error: vendorError } = await db()
      .from('vendors')
      .select('name, status')
      .eq('id', vendorId)
      .maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor) return sendError(res, 404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    if (vendor.status !== 'approved') return sendError(res, 409, 'VENDOR_NOT_APPROVED', 'Approve the vendor before inviting staff');

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = addSouthAfricanBusinessDays(new Date(), 3).toISOString();
    const inviteUrl = new URL(`/vendor-invitations/${token}`, process.env.CLIENT_ORIGIN || 'http://localhost:5173').toString();
    const invitation = {
      email: parsed.value.email,
      role: parsed.value.role,
      status: 'pending',
      expires_at: expiresAt,
    };
    const emailHtml = vendorInvitationEmail({
      vendorName: vendor.name,
      role: invitation.role,
      inviteUrl,
      expiresAt,
    });
    const { data: invitationId, error: createError } = await db().rpc('create_vendor_invitation', {
      p_vendor_id: vendorId,
      p_email: parsed.value.email,
      p_role: parsed.value.role,
      p_created_by: req.user.id,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });
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

    return respond(req, res, { success: true, invitation }, { status: 201 });
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
      return sendError(res, 403, 'EMAIL_VERIFICATION_REQUIRED', 'Verify your email address before accepting this invitation');
    }
    const { data, error } = await db().rpc('redeem_vendor_invitation', {
      p_token_hash: hashToken(token),
      p_user_id: req.user.id,
      p_email: req.user.email || '',
    });
    if (error) throw error;
    if (!data?.success) {
      const responses = {
        NOT_FOUND: [404, 'INVITATION_NOT_FOUND', 'Invitation not found'],
        EXPIRED: [410, 'INVITATION_EXPIRED', 'This invitation has expired'],
        REVOKED: [410, 'INVITATION_REVOKED', 'This invitation has been revoked'],
        ACCEPTED: [410, 'INVITATION_ALREADY_USED', 'This invitation has already been used'],
        EMAIL_MISMATCH: [403, 'INVITATION_EMAIL_MISMATCH', 'Sign in with the email address this invitation was sent to'],
        VENDOR_UNAVAILABLE: [410, 'VENDOR_UNAVAILABLE', 'This vendor is not currently accepting invitations'],
      };
      const [status, code, message] = responses[data?.code] || [409, 'INVITATION_UNAVAILABLE', 'This invitation is no longer available'];
      return sendError(res, status, code, message);
    }
    return respond(req, res, { success: true, invitation: data });
  } catch (error) {
    return handleError(res, error);
  }
}
