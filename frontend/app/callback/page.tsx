import CallbackClient from '@/components/CallbackClient';

// Do not wrap CallbackClient with ClientPageWrapper,
// as CallbackClient already has its own internal Suspense boundary
export default function CallbackPage() {
  return <CallbackClient />;
}
