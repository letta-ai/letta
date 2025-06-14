'use client';

import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { Link, ZapierLogoMark } from '@letta-cloud/ui-component-library';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface DefinedUrlSetupType {
  url: string;
  type: 'url';
}

interface CustomUrlSetupType {
  type: 'custom-url';
  instructions: React.ReactNode;
}

export interface RecommendedServer {
  logo: React.ReactNode;
  baseUrl: string;
  name: string;
  id: 'zapier';
  description: string;
  setup: CustomUrlSetupType | DefinedUrlSetupType;
}

export type CustomUrlRecommendedServer = Omit<RecommendedServer, 'setup'> & {
  setup: CustomUrlSetupType;
};

export function useRecommendedMCPServers(): RecommendedServer[] {
  const t = useTranslations('ToolManager/RecommendedMCPServers');
  const { data: enabled } = useFeatureFlag('RECOMMENDED_MCP');

  return useMemo(() => {
    const recommendedServers: RecommendedServer[] = [
      {
        id: 'zapier',
        baseUrl: 'https://mcp.zapier.com',
        setup: {
          type: 'custom-url',
          instructions: t.rich('zapier.instructions', {
            link: (chunks) => (
              <Link target="_blank" href="https://mcp.zapier.com/">
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <ZapierLogoMark />,
        name: 'Zapier',
        description: t('zapier.description'),
      },
    ];

    return enabled ? recommendedServers : [];
  }, [t, enabled]);
}
