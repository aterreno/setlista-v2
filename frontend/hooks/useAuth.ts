import { useState, useEffect } from 'react';

interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
}

// Token storage keys
const TOKEN_KEY = 'spotify_access_token';
const EXPIRES_KEY = 'spotify_token_expires';

// Hook for handling Spotify authentication
export const useAuth = (): [
  AuthState,
  (token: string, expiresIn: number) => void,
  () => void
] => {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: null,
    expiresAt: null,
    isAuthenticated: false,
  });

  // Initialize auth state from localStorage on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedExpiry = localStorage.getItem(EXPIRES_KEY);
    
    if (storedToken && storedExpiry) {
      const expiresAt = parseInt(storedExpiry, 10);
      
      // Check if token is still valid
      if (expiresAt > Date.now()) {
        setAuthState({
          accessToken: storedToken,
          expiresAt,
          isAuthenticated: true,
        });
      } else {
        // Clear expired token
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EXPIRES_KEY);
      }
    }
  }, []);

  // Login function - store token and update state
  const login = (token: string, expiresIn: number) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
    
    setAuthState({
      accessToken: token,
      expiresAt,
      isAuthenticated: true,
    });
  };

  // Logout function - clear token and update state
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    
    setAuthState({
      accessToken: null,
      expiresAt: null,
      isAuthenticated: false,
    });
  };

  return [authState, login, logout];
};
