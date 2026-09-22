import { supabase } from '../../../lib/supabase';

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Validates the username against system syntax and business rules.
 */
export function validateUsernameSyntax(username: string): UsernameValidationResult {
  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Username is required.' };
  }

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long.' };
  }

  if (trimmed.length > 30) {
    return { isValid: false, error: 'Username cannot exceed 30 characters.' };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, and underscores.',
    };
  }

  if (trimmed.toLowerCase().startsWith('user_')) {
    return {
      isValid: false,
      error: 'Username cannot start with the reserved prefix "user_".',
    };
  }

  return { isValid: true };
}

/**
 * Checks whether a given username is available in Supabase.
 * Excludes the current user's ID so their existing username is reported as valid.
 */
export async function checkUsernameAvailability(
  username: string,
  currentUserId?: string,
): Promise<{ available: boolean; error?: string }> {
  const syntaxCheck = validateUsernameSyntax(username);
  if (!syntaxCheck.isValid) {
    return { available: false, error: syntaxCheck.error };
  }

  try {
    let query = supabase
      .from('profiles')
      .select('user_id')
      .ilike('username', username.trim());

    if (currentUserId) {
      query = query.neq('user_id', currentUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { available: false, error: error.message };
    }

    // If a profile with this username exists, it is NOT available
    if (data) {
      return { available: false, error: 'This username is already taken.' };
    }

    return { available: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error verifying username availability.';
    return { available: false, error: message };
  }
}
