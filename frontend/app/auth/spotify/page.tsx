'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

// Get base API URL from environment or default to localhost
// Make sure we handle both cases where API_URL might or might not include '/api' at the end
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SpotifyAuthPage() {
  const router = useRouter();
  
  useEffect(() => {
    async function redirectToSpotifyAuth() {
      try {
        // Handle API paths to use consistent formatting
        const apiBasePath = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
        const endpoint = `${apiBasePath}/spotify/auth`;
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
