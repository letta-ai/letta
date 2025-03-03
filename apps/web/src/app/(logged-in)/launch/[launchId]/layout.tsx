import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { router } from '$web/web-api/router';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '@letta-cloud/sdk-web';
import { db, shareChatUser } from '@letta-cloud/service-database';
import { getUserOrRedirect } from '$web/server/auth';
import { and, eq } from 'drizzle-orm';

interface ChatLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    launchId: string;
  }>;
}

export default async function LaunchLayout(props: ChatLayoutProps) {
  const { children, params } = props;
  const user = await getUserOrRedirect();

  if (!user) {
    redirect('/');
    return null;
  }

  const { launchId } = await params;
  const queryClient = new QueryClient();

  const launchLinkDetails =
    await router.launchLinks.getLaunchLinkMetadataByLaunchId({
      params: {
        launchId,
      },
    });

  if (launchLinkDetails.status !== 200 || !launchLinkDetails.body) {
    redirect('/');
    return null;
  }

  const existingShareChat = await db.query.shareChatUser.findFirst({
    where: and(
      eq(shareChatUser.userId, user.id),
      eq(shareChatUser.agentTemplateId, launchLinkDetails.body.agentTemplateId),
    ),
  });

  if (existingShareChat) {
    redirect(`/chat/${existingShareChat.chatId}`);
    return null;
  }

  await queryClient.prefetchQuery({
    queryKey:
      webApiQueryKeys.launchLinks.getLaunchLinkMetadataByLaunchId(launchId),
    queryFn: () => launchLinkDetails,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
