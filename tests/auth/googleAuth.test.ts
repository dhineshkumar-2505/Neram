import * as WebBrowser from 'expo-web-browser';
import { extractParamsFromUrl, signInWithGoogle } from '../../src/services/auth/googleAuth';
import { supabase } from '../../src/lib/supabase';

// Mock WebBrowser, expo-auth-session, and Supabase
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'neram://auth/callback'),
}));

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      setSession: jest.fn(),
    },
  },
}));

describe('Google OAuth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractParamsFromUrl', () => {
    it('extracts query code parameter correctly', () => {
      const url = 'neram://auth/callback?code=mock_pkce_code_12345';
      const result = extractParamsFromUrl(url);

      expect(result.code).toBe('mock_pkce_code_12345');
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('extracts implicit hash fragment tokens correctly', () => {
      const url =
        'neram://auth/callback#access_token=mock_access_jwt&refresh_token=mock_refresh_jwt&token_type=bearer';
      const result = extractParamsFromUrl(url);

      expect(result.accessToken).toBe('mock_access_jwt');
      expect(result.refreshToken).toBe('mock_refresh_jwt');
      expect(result.code).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('extracts error parameters from query and hash', () => {
      const queryErrorUrl = 'neram://auth/callback?error=access_denied&error_description=User%20cancelled';
      const result1 = extractParamsFromUrl(queryErrorUrl);
      expect(result1.error).toBe('User cancelled');

      const hashErrorUrl = 'neram://auth/callback#error=unauthorized_client';
      const result2 = extractParamsFromUrl(hashErrorUrl);
      expect(result2.error).toBe('unauthorized_client');
    });

    it('handles empty or parameterless url safely', () => {
      const url = 'neram://auth/callback';
      const result = extractParamsFromUrl(url);

      expect(result.code).toBeUndefined();
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('preserves equal signs in base64 tokens and decodes plus as spaces', () => {
      const url =
        'neram://auth/callback#access_token=eyJhbGciOi...==&refresh_token=dGVzdF9yZWZyZXNo==&error_description=OAuth+provider+failed+auth';
      const result = extractParamsFromUrl(url);

      expect(result.accessToken).toBe('eyJhbGciOi...==');
      expect(result.refreshToken).toBe('dGVzdF9yZWZyZXNo==');
      expect(result.error).toBe('OAuth provider failed auth');
    });
  });

  describe('signInWithGoogle', () => {
    it('returns error if supabase signInWithOAuth fails', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'OAuth provider disabled' },
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth provider disabled');
      expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    });

    it('returns error if supabase provides no authorization URL', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: { url: null },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No authorization URL returned from Supabase.');
    });

    it('handles user cancellation gracefully', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
        error: null,
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: 'cancel',
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('handles user dismissing the browser modal', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
        error: null,
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: 'dismiss',
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it('completes sign in successfully using PKCE authorization code exchange', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
        error: null,
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: 'success',
        url: 'neram://auth/callback?code=pkce_valid_auth_code',
      });

      const mockSession = {
        access_token: 'valid_access_token',
        refresh_token: 'valid_refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      };

      (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce_valid_auth_code');
      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockSession);
    });

    it('handles PKCE exchange error', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
        error: null,
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: 'success',
        url: 'neram://auth/callback?code=expired_code',
      });

      (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Authorization code has expired' },
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authorization code has expired');
    });

    it('completes sign in successfully using implicit hash tokens', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValueOnce({
        data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
        error: null,
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: 'success',
        url: 'neram://auth/callback#access_token=implicit_access&refresh_token=implicit_refresh',
      });

      const mockSession = {
        access_token: 'implicit_access',
        refresh_token: 'implicit_refresh',
        user: { id: 'user_456' },
      };

      (supabase.auth.setSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const result = await signInWithGoogle();

      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'implicit_access',
        refresh_token: 'implicit_refresh',
      });
      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockSession);
    });

    it('catches and reports unexpected exceptions', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockRejectedValueOnce(
        new Error('Network connectivity lost'),
      );

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connectivity lost');
    });
  });
});
