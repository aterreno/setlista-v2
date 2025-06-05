import SetlistDetailClient from "@/components/SetlistDetailClient"

export default function SetlistDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <SetlistDetailClient id={params.id} />
}
