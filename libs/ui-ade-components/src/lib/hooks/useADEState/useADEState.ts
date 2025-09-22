'use client'
import { useParams, usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { getIsLocalPlatform } from '@letta-cloud/utils-shared';
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
    return (pathname.startsWith('/development-servers') || getIsLocalPlatform());
  }, [pathname]);

  return {
    isLocal,
    adeType: agentId ? 'agent' : 'template' as const,
    isTemplate: !!templateName,
    isAgent: !!agentId,
  };
}
