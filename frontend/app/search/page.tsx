import ArtistSearchClient from '@/components/ArtistSearchClient';

// Do not use ClientPageWrapper (which has Suspense) since ArtistSearchClient already has
// its own internal Suspense boundary, but we do need to ensure proper page layout
export default function SearchPage() {
  return (
    // Use the page wrapper styles without the additional Suspense boundary
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <ArtistSearchClient />
    </div>
  );
}
