import SetlistPageClient from '@/components/SetlistPageClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default function SetlistPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">Loading setlist...</div>}>
      <SetlistPageClient />
    </Suspense>
  );
}
