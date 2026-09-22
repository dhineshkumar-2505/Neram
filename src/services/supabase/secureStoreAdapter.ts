import * as SecureStore from 'expo-secure-store';
import type { SupportedStorage } from '@supabase/supabase-js';

const CHUNK_SIZE = 1800; // Safe threshold well below Android KeyStore 2048 byte limit
const CHUNK_PREFIX = '___CHUNKED___:';

// In-memory fallback for test runners / environments without hardware keystore
const memoryStore = new Map<string, string>();

function isMemoryFallback(): boolean {
  return process.env.NODE_ENV === 'test' || typeof SecureStore.setItemAsync !== 'function';
}

/**
 * Hardware-backed encrypted storage adapter for Supabase Auth on Android.
 * Enforces hardware encryption using Android KeyStore & EncryptedSharedPreferences.
 * Supports automatic transparent chunking for payloads exceeding 1800 bytes.
 */
export const ExpoSecureStoreAdapter: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (isMemoryFallback()) {
        return memoryStore.get(key) ?? null;
      }

      const rawValue = await SecureStore.getItemAsync(key);
      if (!rawValue) {
        return null;
      }

      if (rawValue.startsWith(CHUNK_PREFIX)) {
        const chunkCount = parseInt(rawValue.replace(CHUNK_PREFIX, ''), 10);
        if (isNaN(chunkCount) || chunkCount <= 0) {
          return null;
        }

        const chunks: string[] = [];
        for (let i = 0; i < chunkCount; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
          if (chunk === null) {
            // Missing chunk indicates corrupted state
            return null;
          }
          chunks.push(chunk);
        }
        return chunks.join('');
      }

      return rawValue;
    } catch (error) {
      if (__DEV__) {
        console.warn(`[ExpoSecureStoreAdapter] Failed to getItem('${key}'):`, error);
      }
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isMemoryFallback()) {
        memoryStore.set(key, value);
        return;
      }

      // If value is within single item limits, write directly
      if (value.length <= CHUNK_SIZE) {
        // Clean up any old chunks if previously chunked
        const oldHeader = await SecureStore.getItemAsync(key);
        if (oldHeader && oldHeader.startsWith(CHUNK_PREFIX)) {
          const oldCount = parseInt(oldHeader.replace(CHUNK_PREFIX, ''), 10);
          for (let i = 0; i < oldCount; i++) {
            await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
          }
        }
        await SecureStore.setItemAsync(key, value);
        return;
      }

      // Chunk large values
      const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
      for (let i = 0; i < chunkCount; i++) {
        const chunk = value.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
      }

      // Write chunk header as pointer
      await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunkCount}`);
    } catch (error) {
      if (__DEV__) {
        console.error(`[ExpoSecureStoreAdapter] Failed to setItem('${key}'):`, error);
      }
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isMemoryFallback()) {
        memoryStore.delete(key);
        return;
      }

      const existingHeader = await SecureStore.getItemAsync(key);
      if (existingHeader && existingHeader.startsWith(CHUNK_PREFIX)) {
        const count = parseInt(existingHeader.replace(CHUNK_PREFIX, ''), 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
        }
      }

      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (__DEV__) {
        console.warn(`[ExpoSecureStoreAdapter] Failed to removeItem('${key}'):`, error);
      }
    }
  },
};

export default ExpoSecureStoreAdapter;
