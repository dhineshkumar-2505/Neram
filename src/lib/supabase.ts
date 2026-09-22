import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { ExpoSecureStoreAdapter } from '../services/supabase/secureStoreAdapter';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  if (__DEV__) {
    console.warn(
      '[Supabase] Warning: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is not defined in environment variables. Set them in .env before using database operations.',
    );
  }
}

/**
 * Singleton Supabase Client configured with hardware-encrypted storage (Android KeyStore)
 * and strict database TypeScript types generated from the live PostgreSQL schema.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
