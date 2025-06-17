'use client';

import React, { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import SetlistDetailClient from '@/components/SetlistDetailClient';
import { Loader2 } from 'lucide-react';

/**
 * This component wraps the SetlistDetailClient and provides enhanced error handling
 * and support for direct navigation to setlist detail pages in a static export.
 */
export default function SetlistErrorBoundary() {
  const params = useParams();
  const pathname = usePathname();
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Extract setlist ID from URL path if params are not available
    // This helps with static export direct navigation
    if (!params?.id || params.id === 'placeholder') {
      const pathSegments = pathname?.split('/').filter(Boolean) || [];
      if (pathSegments.length >= 2 && pathSegments[0] === 'setlist') {
        // Use the ID from the URL
        setId(pathSegments[1]);
      }
    } else {
      setId(params.id as string);
    }
    
    setLoading(false);
  }, [params, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
      </div>
    );
  }

  if (!id || id === 'placeholder') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Setlist Not Found</h1>
            <p className="text-gray-400 mb-6">
              We couldn't find the setlist you're looking for. The ID might be invalid or the setlist has been removed.
            </p>
            <Link href="/" className="inline-block bg-green-500 hover:bg-green-600 text-black font-semibold px-6 py-3 rounded-lg">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <SetlistDetailClient id={id} />;
}
