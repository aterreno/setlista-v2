'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// This special page handles 404s and redirects setlist detail URLs
export default function CustomNotFound() {
  const router = useRouter();
  const [message, setMessage] = useState('Page not found');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return;

    const path = window.location.pathname;
    console.log('404 handler - Current path:', path);

    // Check if this is a setlist detail URL
    const setlistMatch = path.match(/\/setlist\/([^/]+)\/?$/);
    
    if (setlistMatch) {
      const setlistId = setlistMatch[1];
      console.log('Detected setlist ID:', setlistId);
      
      if (setlistId && setlistId !== 'placeholder') {
        setMessage(`Redirecting to setlist ${setlistId}...`);
        setRedirecting(true);
        
        // Store the setlist ID in sessionStorage for the home page to pick up
        try {
          sessionStorage.setItem('pendingSetlistId', setlistId);
          
          // Redirect to homepage which will check for pendingSetlistId
          setTimeout(() => {
            router.push('/');
          }, 100);
        } catch (err) {
          console.error('Error storing setlist ID:', err);
          setMessage('Something went wrong. Please try again.');
          setRedirecting(false);
        }
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-8 max-w-md w-full text-center">
        {redirecting ? (
          <>
            <Loader2 className="w-12 h-12 text-green-500 mx-auto animate-spin mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Loading setlist...</h1>
            <p className="text-gray-300">{message}</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-white mb-4">404 - {message}</h1>
            <p className="text-gray-300 mb-8">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-green-500 hover:bg-green-600 text-black font-medium px-6 py-3 rounded-lg"
            >
              Return to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
