import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase.js';
import * as auth from '../services/auth.js';
import { getProfile as fetchProfile, updateProfile as patchProfile } from '../services/profileApi.js';
import {
  confirmedProfileFromResponse,
  onboardingMigrationPatch,
  shouldApplyProfileResponse,
} from '../features/profile/profileState.js';

const AuthContext = createContext(null);

function readLegacyOnboardingFlag() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem('onboarding_completed') === 'true';
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [sessionIssue, setSessionIssue] = useState(false);
  const profileRequestRef = useRef(0);
  const hadSessionRef = useRef(false);
  const explicitSignOutRef = useRef(false);

  /**
   * Profile state is only ever set from a confirmed canonical API response.
   * The request id prevents an older in-flight response from overwriting a
   * newer session, refresh, or explicit update.
   */
  const loadProfile = useCallback(async (token) => {
    const requestId = ++profileRequestRef.current;
    const isActive = () => shouldApplyProfileResponse(requestId, profileRequestRef.current);

    if (!token) {
      if (isActive()) {
        setProfile(null);
        setProfileLoading(false);
      }
      return null;
    }

    setProfileLoading(true);

    try {
      const payload = await fetchProfile({ token });
      let confirmed = null;

      if (isActive()) {
        confirmed = confirmedProfileFromResponse(payload, null);
        setProfile(confirmed);
      }

      const migrationPatch = onboardingMigrationPatch(confirmed, readLegacyOnboardingFlag());
      if (migrationPatch) {
        const migrated = await patchProfile(migrationPatch, { token });
        if (isActive()) {
          confirmed = confirmedProfileFromResponse(migrated, confirmed);
          setProfile(confirmed);
        }
      }

      return confirmed;
    } catch {
      if (isActive()) setProfile(null);
      return null;
    } finally {
      if (isActive()) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialiseAuth = async () => {
      try {
        const { session: currentSession, error: sessionError } = await auth.getSession();
        if (!mounted) return;

        const rejected = auth.isSessionRejection(sessionError);
        setSessionIssue(rejected);
        hadSessionRef.current = !!currentSession;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setSessionReady(true);
        await loadProfile(currentSession?.access_token ?? null);
      } catch {
        if (mounted) {
          setSessionIssue(true);
          setSession(null);
          setUser(null);
          setProfile(null);
          setSessionReady(true);
        }
      } finally {
        if (mounted) setInitialized(true);
      }
    };

    initialiseAuth();

    const { data: { subscription } } = supabase?.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mounted) return;

        const hadSession = hadSessionRef.current;
        hadSessionRef.current = !!nextSession;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setSessionReady(true);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          explicitSignOutRef.current = false;
          setSessionIssue(false);
        }

        if (event === 'SIGNED_IN' && nextSession?.user) {
          await loadProfile(nextSession.access_token);
        }

        if (event === 'SIGNED_OUT') {
          if (hadSession && !explicitSignOutRef.current) setSessionIssue(true);
          profileRequestRef.current += 1;
          setProfile(null);
          setProfileLoading(false);
        }

        if (event === 'USER_UPDATED' && nextSession?.user) {
          setSessionIssue(false);
          await loadProfile(nextSession.access_token);
        }
      },
    ) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      profileRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    return loadProfile(session?.access_token ?? null);
  }, [loadProfile, session?.access_token]);

  const clearSessionIssue = useCallback(() => {
    explicitSignOutRef.current = false;
    setSessionIssue(false);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const token = session?.access_token;
    if (!token) throw new Error('No active session');

    const requestId = ++profileRequestRef.current;
    const isActive = () => shouldApplyProfileResponse(requestId, profileRequestRef.current);
    setProfileLoading(true);

    try {
      const payload = await patchProfile(patch, { token });
      const confirmed = confirmedProfileFromResponse(payload, null);
      if (isActive()) setProfile(confirmed);
      return confirmed;
    } catch (err) {
      // Keep the last confirmed profile when a write fails; local drafts stay
      // owned by the page that produced them.
      throw err;
    } finally {
      if (isActive()) setProfileLoading(false);
    }
  }, [session?.access_token]);

  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const result = await auth.signInWithEmail(email, password);
      clearSessionIssue();
      return result;
    } finally {
      setLoading(false);
    }
  }, [clearSessionIssue]);

  const signUp = useCallback(async (email, password, metadata, options = {}) => {
    setLoading(true);
    try {
      const result = await auth.signUpWithEmail(email, password, metadata, options);
      clearSessionIssue();
      return result;
    } finally {
      setLoading(false);
    }
  }, [clearSessionIssue]);

  const signInWithGoogle = useCallback(async (returnTo) => {
    setLoading(true);
    try {
      clearSessionIssue();
      await auth.signInWithGoogle(returnTo);
    } finally {
      setLoading(false);
    }
  }, [clearSessionIssue]);

  const sendOtp = useCallback(async (email) => {
    setLoading(true);
    try {
      return await auth.sendOtp(email);
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email, token) => {
    setLoading(true);
    try {
      const result = await auth.verifyOtp(email, token);
      clearSessionIssue();
      return result;
    } finally {
      setLoading(false);
    }
  }, [clearSessionIssue]);

  const resetPassword = useCallback(async (newPassword) => {
    setLoading(true);
    try {
      return await auth.resetPassword(newPassword);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    explicitSignOutRef.current = true;
    setSessionIssue(false);
    try {
      await auth.signOut();
      profileRequestRef.current += 1;
      setSession(null);
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      setSessionReady(true);
      navigate('/login', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const value = {
    session,
    user,
    profile,
    profileLoading,
    sessionReady,
    loading,
    initialized,
    sessionIssue,
    isEmailVerified: !!user?.email_confirmed_at,
    signIn,
    signUp,
    signInWithGoogle,
    sendOtp,
    verifyOtp,
    resetPassword,
    refreshProfile,
    updateProfile,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
