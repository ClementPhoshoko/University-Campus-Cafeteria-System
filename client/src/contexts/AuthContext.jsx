import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase.js';
import * as auth from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);

      if (localStorage.getItem('onboarding_completed') === 'true' &&
          !data?.notification_preferences?.onboarding_completed) {
        const updatedPrefs = {
          ...(data.notification_preferences || {}),
          onboarding_completed: true,
        };
        await supabase
          .from('profiles')
          .update({ notification_preferences: updatedPrefs })
          .eq('id', userId);
        setProfile((prev) => prev ? { ...prev, notification_preferences: updatedPrefs } : prev);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialiseAuth = async () => {
      try {
        const session = await auth.getSession();
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) loadProfile(session.user.id);
        }
      } catch {
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) setInitialized(true);
      }
    };

    initialiseAuth();

    const { data: { subscription } } = supabase?.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          loadProfile(session.user.id);
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
        }

        if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
        }

        if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
          loadProfile(session.user.id);
        }
      }
    ) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const data = await auth.signInWithEmail(email, password);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email, password, metadata) => {
    setLoading(true);
    try {
      const data = await auth.signUpWithEmail(email, password, metadata);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      await auth.signInWithGoogle();
    } finally {
      setLoading(false);
    }
  }, []);

  const sendOtp = useCallback(async (email) => {
    setLoading(true);
    try {
      const data = await auth.sendOtp(email);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email, token) => {
    setLoading(true);
    try {
      const data = await auth.verifyOtp(email, token);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (newPassword) => {
    setLoading(true);
    try {
      const data = await auth.resetPassword(newPassword);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await auth.signOut();
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    session,
    user,
    profile,
    loading,
    initialized,
    signIn,
    signUp,
    signInWithGoogle,
    sendOtp,
    verifyOtp,
    resetPassword,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
