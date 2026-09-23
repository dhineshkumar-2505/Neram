import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Instructs WebBrowser to warm up Android Custom Tabs for instant launch
WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthResult {
  success: boolean;
  session?: Session | null;
  error?: string | null;
  cancelled?: boolean;
}

/**
 * Extracts authentication tokens or code from the OAuth callback URL.
 * Handles both implicit flow (#access_token=...) and PKCE flow (?code=...).
 */
export function extractParamsFromUrl(url: string): {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  error?: string;
} {
  const params: Record<string, string> = {};

  const parsePairs = (rawString: string) => {
    const pairs = rawString.split('&');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx !== -1) {
        const rawKey = pair.slice(0, eqIdx);
        const rawVal = pair.slice(eqIdx + 1);
        try {
          const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
          const value = decodeURIComponent(rawVal.replace(/\+/g, ' '));
          if (key) {
            params[key] = value;
          }
        } catch {
          // If decoding fails, fallback to raw
          params[rawKey] = rawVal;
        }
      }
    }
  };

  // Check query params (?key=val)
  const queryStringIndex = url.indexOf('?');
  if (queryStringIndex !== -1) {
    const queryPart = url.substring(queryStringIndex + 1).split('#')[0] ?? '';
    parsePairs(queryPart);
  }

  // Check hash fragment (#key=val)
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    const hashPart = url.substring(hashIndex + 1);
    parsePairs(hashPart);
  }

  return {
    accessToken: params.access_token,
    refreshToken: params.refresh_token,
    code: params.code,
    error: params.error_description || params.error,
  };
}

/**
 * Initiates the Google OAuth Sign-In flow for Android.
 * Opens Android Custom Tabs and exchanges the deep-link callback for a Supabase session.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  try {
    const redirectUrl = makeRedirectUri({
      scheme: 'neram',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.url) {
      return { success: false, error: 'No authorization URL returned from Supabase.' };
    }

    // Launch Android Custom Tab
    const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
      return { success: false, cancelled: true };
    }

    if (authResult.type !== 'success' || !authResult.url) {
      return { success: false, error: 'Authentication session was not completed.' };
    }

    const { accessToken, refreshToken, code, error: urlError } = extractParamsFromUrl(authResult.url);

    if (urlError) {
      return { success: false, error: urlError };
    }

    // If PKCE authorization code was returned, exchange it for session
    if (code) {
      const { data: sessionData, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        return { success: false, error: exchangeError.message };
      }
      return { success: true, session: sessionData.session };
    }

    // If implicit tokens were returned, set session directly
    if (accessToken && refreshToken) {
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        return { success: false, error: sessionError.message };
      }
      return { success: true, session: sessionData.session };
    }

    return {
      success: false,
      error: 'Callback URL did not contain valid authentication credentials.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected Google Sign-In error.';
    return { success: false, error: message };
  }
}
