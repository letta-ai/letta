'use client';

import type { ReactNode } from 'react';
import { Provider } from 'jotai';
import { Toaster } from '@letta-cloud/ui-component-library';

interface ClientSideProvidersProps {
  children: ReactNode;
}

export function ClientSideProviders(props: ClientSideProvidersProps) {
  const { children } = props;

  return (
    <>
      <Provider>{children}</Provider>
      <Toaster />
    </>
  );
}
