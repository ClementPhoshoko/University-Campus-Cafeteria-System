import { supabaseAdmin } from '../config/supabase.js';

/**
 * Bootstrap the super admin user
 * - Looks up the user by email from SUPER_ADMIN_EMAIL in .env
 * - Ensures they have the `admin` role in user_roles
 * - Logs the result at server startup
 */
export async function bootstrapSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;

  if (!email) {
    console.log('[SuperAdmin] SUPER_ADMIN_EMAIL not set — skipping bootstrap.');
    return;
  }

  if (!supabaseAdmin) {
    console.error('[SuperAdmin] supabaseAdmin not configured — cannot bootstrap.');
    return;
  }

  try {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .limit(1);

    if (profileError) {
      console.error('[SuperAdmin] Failed to find profile:', profileError.message);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log(`[SuperAdmin] No user found with email "${email}". Create the account first, then restart the server.`);
      return;
    }

    const profile = profiles[0];

    const { error: insertError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        { user_id: profile.id, role: 'admin', granted_by: profile.id },
        { onConflict: 'user_id,role' },
      );

    if (insertError) {
      console.error('[SuperAdmin] Failed to assign admin role:', insertError.message);
      return;
    }

    console.log(`[SuperAdmin] Admin role ensured for ${email}`);
  } catch (err) {
    console.error('[SuperAdmin] Bootstrap error:', err.message);
  }
}
