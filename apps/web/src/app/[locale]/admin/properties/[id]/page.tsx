import { AdminPropertyDetailView } from '@/components/admin/admin-property-detail-view';

type Props = { params: Promise<{ id: string }> };

export default async function AdminPropertyDetailPage({ params }: Props) {
  const { id } = await params;
  return <AdminPropertyDetailView propertyId={id} />;
}
