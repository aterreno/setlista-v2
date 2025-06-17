import SetlistErrorBoundaryClient from '@/components/SetlistErrorBoundaryClient';
import ClientPageWrapper from '@/components/ClientPageWrapper';

// This dummy generateStaticParams allows us to use static export
// In a real production app, you would fetch actual data from your API
export async function generateStaticParams() {
  // For static export, we need to return at least one param
  // This ensures Next.js knows how to generate this route
  return [{ id: 'placeholder' }]
}

// This page can now be statically exported
export default function SetlistDetailPage() {
  return (
    <ClientPageWrapper>
      <SetlistErrorBoundaryClient />
    </ClientPageWrapper>
  );
}
