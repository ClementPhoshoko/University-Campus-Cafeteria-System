import { supabase } from '../config/supabase.js';

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' }
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: error.message }
    });
  }

  // Fetch profile to attach role info
  const { data: profile, error: profileError } = await supabase
    .from('public.profiles')
    .select('*, user_roles(role)')
    .eq('id', data.user.id)
    .single();

  if (profileError) {
    return res.status(500).json({
      success: false,
      error: { code: 'PROFILE_ERROR', message: profileError.message }
    });
  }

  // Build user object with roles
  const userRoles = profile.user_roles ? profile.user_roles.map(ur => ur.role) : [];
  const user = {
    id: data.user.id,
    email: data.user.email,
    full_name: profile.full_name,
    employee_number: profile.employee_number,
    role: userRoles[0] || 'employee',
    roles: userRoles
  };

  res.json({
    success: true,
    user,
    session: data.session
  });
}

export async function logout(req, res) {
  await supabase.auth.signOut();
  res.json({ success: true });
}

export async function refresh(req, res) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return res.status(401).json({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
  }
  res.json({ success: true, session: data.session });
}

export async function me(req, res) {
  const { data: profile, error: profileError } = await supabase
    .from('public.profiles')
    .select('*, user_roles(role)')
    .eq('id', req.user?.id)
    .single();

  if (profileError) {
    return res.status(404).json({
      success: false,
      error: { code: 'PROFILE_NOT_FOUND', message: profileError.message }
    });
  }

  const userRoles = profile.user_roles ? profile.user_roles.map(ur => ur.role) : [];
  const user = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    employee_number: profile.employee_number,
    role: userRoles[0] || 'employee',
    roles: userRoles,
    department: profile.department,
    business_unit: profile.business_unit,
    cost_centre: profile.cost_centre,
    preferred_site_id: profile.preferred_site_id,
    preferred_building_id: profile.preferred_building_id
  };

  res.json({ success: true, user });
}