import { useCallback, useEffect, useState } from 'react';
import { AuthState } from '../types/index.ts';

const TOKEN_STORAGE_KEY = 'spotify_auth';

export const useAuth = (): [
  AuthState,
  (token: string, expiresIn: number) => void,
  () => void
] => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    expiresAt: null,
  });

  useEffect(() => {
    // Load auth state from localStorage on component mount
    const storedAuth = localStorage.getItem(TOKEN_STORAGE_KEY);
    
    if (storedAuth) {
      const parsedAuth = JSON.parse(storedAuth) as AuthState;
      
      // Check if token is still valid
      if (parsedAuth.expiresAt && parsedAuth.expiresAt > Date.now()) {
        setAuthState(parsedAuth);
      } else {
        // Token expired, clear it
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  }, []);

  const login = useCallback((token: string, expiresIn: number) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    
    const newAuthState: AuthState = {
      isAuthenticated: true,
      accessToken: token,
      expiresAt,
    };
    
    // Save to state and localStorage
    setAuthState(newAuthState);
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(newAuthState));
  }, []);

  const logout = useCallback(() => {
    // Clear auth state
    setAuthState({
      isAuthenticated: false,
      accessToken: null,
      expiresAt: null,
    });
    
    // Remove from localStorage
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  return [authState, login, logout];
};