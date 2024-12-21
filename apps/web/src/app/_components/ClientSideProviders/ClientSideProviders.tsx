'use client';

import { QueryClientProviders } from './QueryClientProviders/QueryClientProviders';
import type { ReactNode } from 'react';
import { Provider } from 'jotai';
import { Toaster } from '@letta-web/component-library';

interface ClientSideProvidersProps {
  children: ReactNode;
}

export function ClientSideProviders(props: ClientSideProvidersProps) {
  const { children } = props;

  return (
    <QueryClientProviders>
      <Provider>{children}</Provider>
      <Toaster />
    </QueryClientProviders>
  );
}
