'use client';

import type { ReactNode } from 'react';
import { Provider } from 'jotai';
import { Toaster } from '@letta-cloud/ui-component-library';
import { PHProvider } from '@letta-cloud/service-analytics/client';

interface ClientSideProvidersProps {
  children: ReactNode;
}

export function ClientSideProviders(props: ClientSideProvidersProps) {
  const { children } = props;

  return (
    <>
      <PHProvider>
        <Provider>{children}</Provider>
      </PHProvider>
      <Toaster />
    </>
  );
}
