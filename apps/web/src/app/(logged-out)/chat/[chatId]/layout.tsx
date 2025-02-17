import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { router } from '$web/web-api/router';
import { redirect } from 'next/navigation';
import { webApiQueryKeys } from '@letta-cloud/web-api-client';

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

  const chatDetails = await router.sharedAgentChats.getSharedAgentFromChatId({
    params: {
      chatId,
    },
  });

  if (chatDetails.status !== 200 || !chatDetails.body) {
    redirect('/');
    return null;
  }

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.sharedAgentChats.getSharedAgentFromChatId(chatId),
    queryFn: () => chatDetails,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
