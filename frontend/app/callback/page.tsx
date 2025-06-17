'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Music } from 'lucide-react';
import { handleSpotifyCallback } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function CallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [authState, login] = useAuth();

  // Run authentication only once when component mounts
  // Get return URL from session storage or default to homepage
  const getReturnUrl = () => {
    if (typeof window !== 'undefined') {
      const returnTo = sessionStorage.getItem('spotify_return_url');
      if (returnTo) {
        // Clear the stored value
        sessionStorage.removeItem('spotify_return_url');
        
        // If it's a full URL with origin, use it directly
        if (returnTo.startsWith('http')) {
          return returnTo;
        }
        // Otherwise treat it as a relative path
        return returnTo;
      }
    }
    return '/';
  };

  useEffect(() => {
    // Skip if we've already attempted auth
    if (attempted) return;
    setAttempted(true);
    
    // Store returnTo parameter in session storage if present
    const returnTo = searchParams.get('returnTo');
    if (returnTo && typeof window !== 'undefined') {
      sessionStorage.setItem('spotify_return_url', returnTo);
    }

    async function handleAuth() {
      try {
        // Check if we're on /callback/ (with trailing slash)
        // This check helps recover parameters lost in redirect
        if (typeof window !== 'undefined' && window.location.pathname === '/callback/') {
          // Try to recover from session storage if available
          const storedToken = sessionStorage.getItem('pending_spotify_token');
          const storedExpiry = sessionStorage.getItem('pending_spotify_expiry');
          
          if (storedToken && storedExpiry) {
            console.log('Recovered token from session storage after redirect');
            login(storedToken, parseInt(storedExpiry, 10));
            
            // Clear the stored values
            sessionStorage.removeItem('pending_spotify_token');
            sessionStorage.removeItem('pending_spotify_expiry');
            
            // Wait a moment before redirecting
            const returnUrl = getReturnUrl();
            setTimeout(() => router.push(returnUrl), 1500);
            return;
          }
        }
        
        // Get tokens from query parameters
        const accessToken = searchParams.get('access_token');
        const expiresIn = searchParams.get('expires_in');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          setError(`Authentication failed: ${errorParam}`);
          return;
        }

        // Handle query parameter tokens
        if (accessToken && expiresIn) {
          console.log('Token received from query parameters');
          
          // Save to session storage before processing (in case of redirect)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('pending_spotify_token', accessToken);
            sessionStorage.setItem('pending_spotify_expiry', expiresIn);
          }
          
          login(accessToken, parseInt(expiresIn, 10));
          
          // Wait a moment before redirecting
          const returnUrl = getReturnUrl();
          setTimeout(() => router.push(returnUrl), 1500);
          return;
        }

        // OAuth code flow (fallback)
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
          setError('No authentication parameters found in URL');
          return;
        }

        console.log('Exchanging code for token');
        const response = await handleSpotifyCallback(code, state || '');
        
        if (response?.accessToken) {
          login(response.accessToken, response.expiresIn || 3600);
          const returnUrl = getReturnUrl();
          setTimeout(() => router.push(returnUrl), 1500);
        } else {
          setError('Failed to authenticate with Spotify');
        }
      } catch (err) {
        console.error('Authentication error:', err);
        setError('An error occurred during authentication');
      }
    }

    handleAuth();
    // searchParams is stable in Next.js 13+
  }, [searchParams, attempted, login, router]);
  
  // Add router to dependency list when using it directly in useEffect
  useEffect(() => {
    if (authState.isAuthenticated) {
      const returnUrl = getReturnUrl();
      const timer = setTimeout(() => router.push(returnUrl), 1500);
      return () => clearTimeout(timer);
    }
  }, [authState.isAuthenticated, router, login]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <div className="flex items-center justify-center mb-8">
          <Music className="h-12 w-12 text-green-400" />
          <span className="text-4xl font-bold text-white ml-4">setlista</span>
        </div>
        
        {error ? (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6 max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-white mb-2">Authentication Error</h2>
            <p className="text-gray-300">{error}</p>
            <button 
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white"
            >
              Return to Home
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-green-400 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-white">Authenticating with Spotify...</h2>
            <p className="text-gray-400 mt-2">You'll be redirected shortly</p>
          </div>
        )}
      </div>
    </div>
  );
}
