import SpotifyAuthClient from '@/components/SpotifyAuthClient';

// Do not wrap with ClientPageWrapper - SpotifyAuthClient already has its own Suspense boundary
export default function SpotifyAuthPage() {
  return <SpotifyAuthClient />;
}
