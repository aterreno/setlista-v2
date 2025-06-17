'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function DebugRoutePage() {
  const pathname = usePathname();
  const [clientInfo, setClientInfo] = useState<{
    href: string;
    pathname: string;
    search: string;
  }>({ href: '', pathname: '', search: '' });

  useEffect(() => {
    // Only run on client
    if (typeof window !== 'undefined') {
      setClientInfo({
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
      });
    }
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Route Debugging Page</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-4">
        <h2 className="text-xl font-semibold mb-2">Next.js Router</h2>
        <p><strong>Next.js pathname:</strong> {pathname}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg mb-4">
        <h2 className="text-xl font-semibold mb-2">Browser Location</h2>
        <p><strong>window.location.pathname:</strong> {clientInfo.pathname}</p>
        <p><strong>window.location.href:</strong> {clientInfo.href}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Test Navigation</h2>
        <div className="flex flex-col gap-2">
          <Link href="/" className="text-blue-600 hover:underline">Home (Next.js Link)</Link>
          <Link href="/setlist/33a2d861/" className="text-blue-600 hover:underline">Setlist with trailing slash (Next.js Link)</Link>
          <Link href="/setlist/33a2d861" className="text-blue-600 hover:underline">Setlist without trailing slash (Next.js Link)</Link>
        </div>
      </div>
    </div>
  );
}
