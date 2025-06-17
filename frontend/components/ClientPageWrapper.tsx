'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Enhanced loading component with better styling
function SuspenseFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-green-500 mx-auto" />
        <p className="text-xl text-white mt-4">Loading...</p>
      </div>
    </div>
  );
}

// This is a specialized wrapper for Next.js client components that use navigation hooks
// It ensures proper Suspense boundaries are in place for static export compatibility
// Next.js requires all useSearchParams(), useRouter(), and usePathname() hooks to be
// properly wrapped in a Suspense boundary for static export to work correctly
interface ClientPageWrapperProps {
  children: React.ReactNode;
}

// CRITICAL: This component must be used to wrap ALL client components that use
// navigation hooks like useSearchParams, useRouter, usePathname, etc.
// This ensures Next.js static export compatibility and prevents build errors
export default function ClientPageWrapper({ children }: ClientPageWrapperProps) {
  // This component ensures that all navigation hooks are properly wrapped
  // with the required Suspense boundary for Next.js static export mode
  return (
    <Suspense fallback={<SuspenseFallback />}>
      {children}
    </Suspense>
  );
}
