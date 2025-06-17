import HomeClient from '@/components/HomeClient';

// Do not wrap with ClientPageWrapper - HomeClient already has its own Suspense boundary
export default function Home() {
  return <HomeClient />;
}
