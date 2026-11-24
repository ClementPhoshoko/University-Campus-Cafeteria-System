import { supabase } from './supabase.js';
import { isSessionRejection } from '../utils/sessionState.js';

export { isSessionRejection };

export async function signInWithEmail(email, password) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password, metadata, options = {}) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      ...options,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle(returnTo = '/') {
  if (!supabase) throw new Error('Supabase not configured');
  const callback = new URL('/auth/callback', window.location.origin);
  callback.searchParams.set('returnTo', returnTo);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
    },
  });
  if (error) throw error;
}

export async function sendOtp(email) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
  return data;
}

export async function verifyOtp(email, token) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(newPassword) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (!supabase) return { session: null, error: null };
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session ?? null, error: error ?? null };
}
