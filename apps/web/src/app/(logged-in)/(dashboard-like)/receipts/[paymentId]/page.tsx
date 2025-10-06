import { getReceiptUrl } from '@letta-cloud/service-payments';
import { redirect } from 'next/navigation';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { NoReceiptView } from './NoReceiptView';

interface ReceiptPageProps {
  params: Promise<{ paymentId: string }>;
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const user = await getUserWithActiveOrganizationIdOrThrow();

  if (!user) {
    redirect('/login');
  }

  const { paymentId } = await params;
  const receiptUrl = await getReceiptUrl({
    paymentIntentId: paymentId,
    organizationId: user.activeOrganizationId,
  });

  if (!receiptUrl) {
    return <NoReceiptView />;
  }

  redirect(receiptUrl);

  return null;
}

export const dynamic = 'force-dynamic';

export const revalidate = 0;
