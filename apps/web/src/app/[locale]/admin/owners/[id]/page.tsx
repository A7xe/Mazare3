import { AdminPartnerDetailView } from '@/components/admin/admin-partner-detail-view';

type Props = { params: Promise<{ id: string }> };

export default async function AdminOwnerDetailPage({ params }: Props) {
  const { id } = await params;
  return <AdminPartnerDetailView ownerId={id} />;
}
