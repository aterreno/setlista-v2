'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SetlistDetailClient from '@/components/SetlistDetailClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function SetlistPage() {
  const searchParams = useSearchParams();
  const [setlistId, setSetlistId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get setlist ID from query parameter
    const id = searchParams.get('id');
    
    if (!id) {
      setError('Setlist ID is missing');
      setIsLoading(false);
      return;
    }
    
    setSetlistId(id);
    setIsLoading(false);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (error || !setlistId) {
    return (
      <Alert variant="destructive" className="max-w-xl mx-auto mt-8">
        <AlertDescription>
          {error || 'Setlist not found. Please check the URL and try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  return <SetlistDetailClient id={setlistId} />;
}
