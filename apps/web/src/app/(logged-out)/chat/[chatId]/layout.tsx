import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { router } from '$web/web-api/router';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '@letta-cloud/sdk-web';
import { getUser } from '$web/server/auth';

interface ChatLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    chatId: string;
  }>;
}

export default async function ChatLayout(props: ChatLayoutProps) {
  const { children, params } = props;

  const { chatId } = await params;
  const queryClient = new QueryClient();

  const [chatDetails, user] = await Promise.all([
    router.sharedAgentChats.getSharedAgentFromChatId({
      params: {
        chatId,
      },
    }),
    getUser(),
  ]);

  if (chatDetails.status !== 200 || !chatDetails.body) {
    redirect('/');
    return null;
  }

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.sharedAgentChats.getSharedAgentFromChatId(chatId),
    queryFn: () => chatDetails,
  });

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.user.getCurrentUser,
    queryFn: () => ({
      body: user,
    }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
