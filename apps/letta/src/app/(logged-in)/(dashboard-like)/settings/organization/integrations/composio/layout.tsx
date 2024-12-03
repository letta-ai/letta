import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { webApiQueryKeys } from '$letta/client';
import { COMPOSE_IO_KEY_NAME } from '$letta/web-api/environment-variables/environmentVariablesContracts';
import { router } from '$letta/web-api/router';

interface ComposioIntegrationLayoutProps {
  children: React.ReactNode;
}

async function ComposioIntegrationLayout(
  props: ComposioIntegrationLayoutProps
) {
  const { children } = props;

  const queryClient = new QueryClient();

  const res = await router.environmentVariables.getEnvironmentVariableByKey({
    params: {
      key: COMPOSE_IO_KEY_NAME,
    },
  });

  if (res.status === 200) {
    await queryClient.prefetchQuery({
      queryKey:
        webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
          COMPOSE_IO_KEY_NAME
        ),
      queryFn: () => ({
        status: 200,
        body: res.body,
      }),
    });
  } else if (res.status === 404) {
    await queryClient.prefetchQuery({
      queryKey:
        webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
          COMPOSE_IO_KEY_NAME
        ),
      queryFn: () => ({
        status: 404,
        body: {},
      }),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

export default ComposioIntegrationLayout;
