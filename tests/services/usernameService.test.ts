import {
  validateUsernameSyntax,
  checkUsernameAvailability,
} from '../../src/features/profile/services/usernameService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('usernameService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUsernameSyntax', () => {
    it('accepts valid alphanumeric usernames', () => {
      expect(validateUsernameSyntax('alex_chen').isValid).toBe(true);
      expect(validateUsernameSyntax('john123').isValid).toBe(true);
      expect(validateUsernameSyntax('cool_dev_99').isValid).toBe(true);
    });

    it('rejects empty username', () => {
      const result = validateUsernameSyntax('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username is required.');
    });

    it('rejects username shorter than 3 characters', () => {
      const result = validateUsernameSyntax('al');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be at least 3 characters long.');
    });

    it('rejects username longer than 20 characters', () => {
      const longName = 'a'.repeat(21);
      const result = validateUsernameSyntax(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username cannot exceed 20 characters.');
    });

    it('rejects uppercase characters to match PostgreSQL constraint', () => {
      const result = validateUsernameSyntax('AlexChen');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        'Username can only contain lowercase letters, numbers, and underscores.',
      );
    });

    it('rejects special characters other than underscore', () => {
      expect(validateUsernameSyntax('alex-chen').isValid).toBe(false);
      expect(validateUsernameSyntax('alex.chen').isValid).toBe(false);
      expect(validateUsernameSyntax('alex@chen').isValid).toBe(false);
      expect(validateUsernameSyntax('alex chen').isValid).toBe(false);
    });

    it('rejects reserved prefix user_', () => {
      const result = validateUsernameSyntax('user_a8b9c0d1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username cannot start with the reserved prefix "user_".');
    });
  });

  describe('checkUsernameAvailability', () => {
    it('returns error if syntax validation fails', async () => {
      const result = await checkUsernameAvailability('ab');
      expect(result.available).toBe(false);
      expect(result.error).toBe('Username must be at least 3 characters long.');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('reports available if no matching profile exists', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({ data: null, error: null });
      const mockNeq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockIlike = jest.fn().mockReturnValue({ neq: mockNeq, maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ ilike: mockIlike });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await checkUsernameAvailability('unique_user', 'user_123');

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('reports unavailable if matching profile exists', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: { user_id: 'other_user_456' },
        error: null,
      });
      const mockNeq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockIlike = jest.fn().mockReturnValue({ neq: mockNeq, maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ ilike: mockIlike });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await checkUsernameAvailability('existing_user', 'user_123');

      expect(result.available).toBe(false);
      expect(result.error).toBe('This username is already taken.');
    });

    it('handles database error gracefully', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection error' },
      });
      const mockSelect = jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await checkUsernameAvailability('valid_user');

      expect(result.available).toBe(false);
      expect(result.error).toBe('Database connection error');
    });
  });
});
