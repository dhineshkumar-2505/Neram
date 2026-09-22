import { ExpoSecureStoreAdapter } from '../../src/services/supabase/secureStoreAdapter';

describe('ExpoSecureStoreAdapter', () => {
  const TEST_KEY = 'test_auth_key';

  afterEach(async () => {
    await ExpoSecureStoreAdapter.removeItem(TEST_KEY);
  });

  it('stores and retrieves small values accurately', async () => {
    const payload = JSON.stringify({ access_token: 'abc123token', user_id: 'user-uuid' });
    await ExpoSecureStoreAdapter.setItem(TEST_KEY, payload);

    const retrieved = await ExpoSecureStoreAdapter.getItem(TEST_KEY);
    expect(retrieved).toBe(payload);
  });

  it('returns null for non-existent keys', async () => {
    const value = await ExpoSecureStoreAdapter.getItem('non_existent_key_xyz');
    expect(value).toBeNull();
  });

  it('removes stored items cleanly', async () => {
    await ExpoSecureStoreAdapter.setItem(TEST_KEY, 'temporary_val');
    expect(await ExpoSecureStoreAdapter.getItem(TEST_KEY)).toBe('temporary_val');

    await ExpoSecureStoreAdapter.removeItem(TEST_KEY);
    expect(await ExpoSecureStoreAdapter.getItem(TEST_KEY)).toBeNull();
  });

  it('handles large payloads with automatic chunking seamlessly', async () => {
    // Generate a payload larger than 3600 characters (2+ chunks)
    const largeObject = {
      token: 'x'.repeat(4500),
      refresh: 'y'.repeat(1000),
    };
    const largePayload = JSON.stringify(largeObject);

    await ExpoSecureStoreAdapter.setItem(TEST_KEY, largePayload);

    const retrieved = await ExpoSecureStoreAdapter.getItem(TEST_KEY);
    expect(retrieved).toBe(largePayload);
    expect(JSON.parse(retrieved!)).toEqual(largeObject);

    // Verify deletion cleans up both header and chunks
    await ExpoSecureStoreAdapter.removeItem(TEST_KEY);
    expect(await ExpoSecureStoreAdapter.getItem(TEST_KEY)).toBeNull();
  });

  it('handles overwriting chunked payload with smaller non-chunked payload', async () => {
    const largePayload = 'a'.repeat(3000);
    await ExpoSecureStoreAdapter.setItem(TEST_KEY, largePayload);
    expect(await ExpoSecureStoreAdapter.getItem(TEST_KEY)).toBe(largePayload);

    const smallPayload = 'small_new_val';
    await ExpoSecureStoreAdapter.setItem(TEST_KEY, smallPayload);
    expect(await ExpoSecureStoreAdapter.getItem(TEST_KEY)).toBe(smallPayload);
  });
});
