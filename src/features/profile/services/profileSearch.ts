import { supabase } from '../../../lib/supabase';

export interface ExactProfileSearchResult {
  userId: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
}

interface RawRpcProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
}

/**
 * Searches for a user profile by exact username.
 * Adheres strictly to SECURITY_PLAN.md: fuzzy matching or enumeration is forbidden.
 * Accepts handles with or without the leading '@'.
 */
export async function searchExactUsername(
  query: string,
): Promise<{ result: ExactProfileSearchResult | null; error?: string }> {
  const cleaned = query.trim().replace(/^@/, '');

  if (cleaned.length < 3) {
    return {
      result: null,
      error: 'Username search query must be at least 3 characters.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('search_exact_username', {
      p_username: cleaned,
    });

    if (error) {
      return { result: null, error: error.message };
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return { result: null };
    }

    const row = data[0] as RawRpcProfile;
    return {
      result: {
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        avatarPath: row.avatar_path,
        bio: row.bio,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected error executing username search.';
    return { result: null, error: message };
  }
}
