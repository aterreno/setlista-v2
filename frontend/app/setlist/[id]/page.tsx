import React from 'react';
import SetlistErrorBoundary from './errorBoundary';

// This dummy generateStaticParams allows us to use static export
// In a real production app, you would fetch actual data from your API
export async function generateStaticParams() {
  // For static export, we need to return at least one param
  // This ensures Next.js knows how to generate this route
  return [{ id: 'placeholder' }]
}

// This page can now be statically exported
export default function SetlistDetailPage() {
  // Use our error boundary component that can extract params from the URL
  // even when client-side routing isn't working properly
  return <SetlistErrorBoundary />
}
