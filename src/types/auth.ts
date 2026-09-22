import type { Session, User } from '@supabase/supabase-js';
import type { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type AuthStatus =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'NEEDS_ONBOARDING'
  | 'AUTHENTICATED';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  setProfile: (profile: Profile) => void;
  updateProfile: (updates: ProfileUpdate) => Promise<Profile | null>;
}
