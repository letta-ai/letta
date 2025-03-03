import type { ReactNode } from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { webApiQueryKeys } from '@letta-cloud/sdk-web';
import { router } from '$web/web-api/router';
import { redirect } from 'next/navigation';

interface BillingLayoutProps {
  children: ReactNode;
}

async function BillingLayout(props: BillingLayoutProps) {
  const { children } = props;

  const queryClient = new QueryClient();

  const res = await router.organizations.getCurrentOrganizationBillingInfo();

  if (res.status !== 200) {
    redirect('/');
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    queryFn: () => res,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

export default BillingLayout;
