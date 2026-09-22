import { searchExactUsername } from '../../src/features/profile/services/profileSearch';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

describe('profileSearch service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects queries shorter than 3 characters', async () => {
    const result = await searchExactUsername('al');
    expect(result.result).toBeNull();
    expect(result.error).toBe('Username search query must be at least 3 characters.');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('strips leading @ symbol and invokes RPC with cleaned username', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          user_id: 'user_uuid_123',
          username: 'mayalin',
          display_name: 'Maya Lin',
          avatar_path: 'user_uuid_123/avatar.jpg',
          bio: 'Architect & designer',
        },
      ],
      error: null,
    });

    const { result, error } = await searchExactUsername('  @mayalin  ');

    expect(supabase.rpc).toHaveBeenCalledWith('search_exact_username', {
      p_username: 'mayalin',
    });
    expect(error).toBeUndefined();
    expect(result).toEqual({
      userId: 'user_uuid_123',
      username: 'mayalin',
      displayName: 'Maya Lin',
      avatarPath: 'user_uuid_123/avatar.jpg',
      bio: 'Architect & designer',
    });
  });

  it('returns null result when username is not found', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result, error } = await searchExactUsername('unknown_user_99');

    expect(result).toBeNull();
    expect(error).toBeUndefined();
  });

  it('handles database RPC error gracefully', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const { result, error } = await searchExactUsername('testuser');

    expect(result).toBeNull();
    expect(error).toBe('Database connection failed');
  });
});
