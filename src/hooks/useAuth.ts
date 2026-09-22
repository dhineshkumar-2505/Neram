import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import type { AuthContextValue } from '../types/auth';

/**
 * Access the application authentication state and management methods.
 * Must be used within an <AuthProvider> tree.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }

  return context;
}

export default useAuth;
