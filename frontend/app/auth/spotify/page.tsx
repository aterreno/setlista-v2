'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

// Get base API URL from environment or default to localhost
// Make sure we handle both cases where API_URL might or might not include '/api' at the end
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SpotifyAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    async function redirectToSpotifyAuth() {
      try {
        // Get returnTo parameter if provided
        const returnTo = searchParams.get('returnTo');
        
        // Handle API paths to use consistent formatting
        const apiBasePath = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
        let endpoint = `${apiBasePath}/spotify/auth`;
        
        // Store returnTo in sessionStorage for more reliable persistence through auth flow
        if (returnTo && typeof window !== 'undefined') {
          // Save the full URL including origin if applicable
          sessionStorage.setItem('spotify_return_url', returnTo);
          console.log(`Stored return URL: ${returnTo}`);
        }
        
        // Always use the same callback URL but indicate if we need to handle a return URL
        const hasReturnPath = returnTo ? 'true' : 'false';
        const callbackUrl = `/callback?hasReturnPath=${hasReturnPath}`;
        endpoint = `${endpoint}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
        
        console.log(`Initiating Spotify auth with callback URL: ${callbackUrl}`);
        const response = await axios.get(endpoint);
        
        if (response.data && response.data.authUrl) {
          // Client-side redirect to Spotify
          window.location.href = response.data.authUrl;
        } else {
          throw new Error('No auth URL returned from API');
        }
      } catch (error) {
        console.error('Error getting Spotify auth URL:', error);
        // Redirect to home page with error
        router.push('/?error=auth_failed');
      }
    }
    
    redirectToSpotifyAuth();
  }, [router]);
  
  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Redirecting to Spotify...</h2>
        <Loader2 className="h-12 w-12 animate-spin text-green-500 mx-auto" />
      </div>
    </div>
  );
}
