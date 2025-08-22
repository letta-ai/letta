'use client'
import { useParams, usePathname } from 'next/navigation';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useMemo } from 'react';
type ADEType = 'agent' | 'template';

interface ADEState {
  isLocal: boolean;
  adeType: ADEType;
  isTemplate: boolean;
  isAgent: boolean;
}

export function useADEState(): ADEState {
  const { agentId, templateName } = useParams<{
    agentId: string;
    templateName: string;
    projectSlug: string;
    entityId?: string;
  }>();

  const pathname = usePathname();

  const isLocal = useMemo(() => {
    return (
      pathname.startsWith('/development-servers') ||
      CURRENT_RUNTIME === 'letta-desktop'
    );
  }, [pathname]);

  return {
    isLocal,
    adeType: agentId ? 'agent' : 'template' as const,
    isTemplate: !!templateName,
    isAgent: !!agentId,
  };
}
