import { OwnerPropertyDetailView } from '@/components/owner/owner-property-detail-view';

type Props = { params: Promise<{ id: string }> };

export default async function OwnerPropertyDetailPage({ params }: Props) {
  const { id } = await params;
  return <OwnerPropertyDetailView propertyId={id} />;
}
