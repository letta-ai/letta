'use client';

import { QueryClientProviders } from './QueryClientProviders/QueryClientProviders';
import type { ReactNode } from 'react';

interface ClientSideProvidersProps {
  children: ReactNode;
}

export function ClientSideProviders(props: ClientSideProvidersProps) {
  const { children } = props;

  return <QueryClientProviders>{children}</QueryClientProviders>;
}
