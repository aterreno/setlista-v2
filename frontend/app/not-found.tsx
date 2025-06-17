import NotFoundClient from '@/components/NotFoundClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

// Server component that wraps the client component with Suspense
export default function CustomNotFound() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">Loading...</div>}>
      <NotFoundClient />
    </Suspense>
  );
}
