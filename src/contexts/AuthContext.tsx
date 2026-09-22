import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  AuthContextValue,
  AuthStatus,
  Profile,
  ProfileUpdate,
} from '../types/auth';

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Determines whether a user requires initial onboarding setup.
 * A user needs onboarding if:
 * 1. Their profile is missing.
 * 2. Their username is the auto-generated fallback prefix (user_<id_prefix>).
 * 3. Their display name is empty or the default placeholder.
 */
export function checkNeedsOnboarding(profile: Profile | null): boolean {
  if (!profile) return true;
  if (!profile.username || profile.username.startsWith('user_')) return true;
  if (!profile.display_name || profile.display_name.trim().length === 0) return true;
  if (profile.display_name === 'Anonymous User') return true;
  return false;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('INITIALIZING');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        if (__DEV__) {
          console.warn('[AuthProvider] Error fetching profile:', profileError.message);
        }
        return null;
      }

      return data as Profile | null;
    } catch (err) {
      if (__DEV__) {
        console.warn('[AuthProvider] Unexpected exception fetching profile:', err);
      }
      return null;
    }
  }, []);

  const resolveAuthState = useCallback(
    async (currentSession: Session | null) => {
      setIsLoading(true);
      setError(null);

      if (!currentSession || !currentSession.user) {
        setSession(null);
        setUser(null);
        setProfileState(null);
        setStatus('UNAUTHENTICATED');
        setIsLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession.user);

      const userProfile = await fetchProfile(currentSession.user.id);
      setProfileState(userProfile);

      const needsOnboarding = checkNeedsOnboarding(userProfile);
      setStatus(needsOnboarding ? 'NEEDS_ONBOARDING' : 'AUTHENTICATED');
      setIsLoading(false);
    },
    [fetchProfile],
  );

  // Initialize session from SecureStore on startup
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (isMounted) {
          await resolveAuthState(initialSession);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[AuthProvider] Failed to initialize session:', err);
        }
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize session');
          setStatus('UNAUTHENTICATED');
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen to real-time auth events from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfileState(null);
        setStatus('UNAUTHENTICATED');
        setIsLoading(false);
        return;
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'INITIAL_SESSION'
      ) {
        await resolveAuthState(newSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [resolveAuthState]);

  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (err) {
      if (__DEV__) {
        console.warn('[AuthProvider] Error during signOut:', err);
      }
      setError(err instanceof Error ? err.message : 'Sign out error');
    } finally {
      setSession(null);
      setUser(null);
      setProfileState(null);
      setStatus('UNAUTHENTICATED');
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    if (!user) return null;
    const freshProfile = await fetchProfile(user.id);
    setProfileState(freshProfile);
    const needsOnboarding = checkNeedsOnboarding(freshProfile);
    setStatus(needsOnboarding ? 'NEEDS_ONBOARDING' : 'AUTHENTICATED');
    return freshProfile;
  }, [user, fetchProfile]);

  const setProfile = useCallback((newProfile: Profile): void => {
    setProfileState(newProfile);
    const needsOnboarding = checkNeedsOnboarding(newProfile);
    setStatus(needsOnboarding ? 'NEEDS_ONBOARDING' : 'AUTHENTICATED');
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdate): Promise<Profile | null> => {
      if (!user) return null;
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (updateError) {
          throw updateError;
        }

        const updatedProfile = data as Profile;
        setProfileState(updatedProfile);
        const needsOnboarding = checkNeedsOnboarding(updatedProfile);
        setStatus(needsOnboarding ? 'NEEDS_ONBOARDING' : 'AUTHENTICATED');
        return updatedProfile;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to update profile';
        setError(errMsg);
        if (__DEV__) {
          console.warn('[AuthProvider] Update profile failed:', errMsg);
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  const contextValue: AuthContextValue = useMemo(
    () => ({
      status,
      session,
      user,
      profile,
      isLoading,
      error,
      signOut,
      refreshProfile,
      setProfile,
      updateProfile,
    }),
    [status, session, user, profile, isLoading, error, signOut, refreshProfile, setProfile, updateProfile],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
