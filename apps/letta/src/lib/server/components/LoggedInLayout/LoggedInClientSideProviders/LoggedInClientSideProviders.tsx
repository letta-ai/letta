'use client';

import { LettaAgentsAPIWrapper } from '@letta-web/letta-agents-api';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOCAL_PROJECT_SERVER_URL } from '$letta/constants';

interface LoggedInClientSideProvidersProps {
  children: React.ReactNode;
}

export function LoggedInClientSideProviders({
  children,
}: LoggedInClientSideProvidersProps) {
  const [baseUrl, setBaseUrl] = useState('');

  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/local-project')) {
      setBaseUrl(LOCAL_PROJECT_SERVER_URL);
    } else {
      setBaseUrl('');
    }
  }, [pathname]);

  return (
    <LettaAgentsAPIWrapper baseUrl={baseUrl}>{children}</LettaAgentsAPIWrapper>
  );
}
