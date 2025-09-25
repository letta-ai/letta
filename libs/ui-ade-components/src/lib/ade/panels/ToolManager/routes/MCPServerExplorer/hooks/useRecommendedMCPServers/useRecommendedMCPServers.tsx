'use client';

import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Link,
  ZapierLogoMark,
  GithubLogoMarkDynamic,
  PipedreamIcon,
  StripeIcon,
  DeepWikiIcon,
  ApifyIcon,
  ExaIcon,
  HuggingFaceIcon,
  ComposioLogoMarkDynamic,
} from '@letta-cloud/ui-component-library';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface DefinedUrlSetupType {
  url: string;
  type: 'url';
}

interface CustomUrlSetupType {
  type: 'custom-url';
  baseUrl: string;
  requiresApiKey: boolean;
  requiresServerUrl?: boolean;
  hideApiKeyField?: boolean;
  placeholder?: string;
  instructions: React.ReactNode;
}

export interface RecommendedServer {
  logo: React.ReactNode;
  baseUrl: string;
  name: string;
  id:
    | 'apify'
    | 'composio'
    | 'deepwiki'
    | 'exa'
    | 'github'
    | 'huggingface'
    | 'pipedream'
    | 'stripe'
    | 'zapier';
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
          baseUrl: 'https://mcp.zapier.com/api/mcp/mcp',
          requiresApiKey: true,
          requiresServerUrl: true, // Add this to enable custom URLs
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
      {
        id: 'github',
        baseUrl: 'https://api.githubcopilot.com',
        setup: {
          type: 'custom-url',
          baseUrl: 'https://api.githubcopilot.com/mcp/',
          requiresApiKey: true,
          instructions: t.rich('github.instructions', {
            link: (chunks) => (
              <Link
                target="_blank"
                href="https://github.com/github/github-mcp-server"
              >
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <GithubLogoMarkDynamic />,
        name: 'GitHub',
        description: t('github.description'),
      },
      {
        id: 'apify',
        baseUrl: 'https://mcp.apify.com',
        setup: {
          type: 'custom-url',
          baseUrl: 'https://mcp.apify.com',
          requiresApiKey: true,
          instructions: t.rich('apify.instructions', {
            link: (chunks) => (
              <Link
                target="_blank"
                href="https://docs.apify.com/platform/integrations/mcp"
              >
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <ApifyIcon />,
        name: 'Apify',
        description: t('apify.description'),
      },
      {
        id: 'deepwiki',
        baseUrl: 'https://mcp.deepwiki.com',
        setup: {
          type: 'custom-url',
          baseUrl: 'https://mcp.deepwiki.com/mcp',
          requiresApiKey: false,
          instructions: t.rich('deepwiki.instructions', {
            link: (chunks) => (
              <Link target="_blank" href="https://docs.devin.ai/deepwiki-mcp">
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <DeepWikiIcon />,
        name: 'DeepWiki',
        description: t('deepwiki.description'),
      },
      {
        id: 'stripe',
        baseUrl: 'https://mcp.stripe.com',
        setup: {
          type: 'custom-url',
          baseUrl: 'https://mcp.stripe.com',
          requiresApiKey: true,
          instructions: t.rich('stripe.instructions', {
            link: (chunks) => (
              <Link
                target="_blank"
                href="https://docs.stripe.com/building-with-llms"
              >
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <StripeIcon />,
        name: 'Stripe',
        description: t('stripe.description'),
      },
      {
        id: 'pipedream',
        baseUrl: 'https://mcp.pipedream.net',
        setup: {
          type: 'custom-url',
          baseUrl: '',
          requiresApiKey: false,
          requiresServerUrl: true,
          instructions: t.rich('pipedream.instructions', {
            link: (chunks) => (
              <Link target="_blank" href="https://mcp.pipedream.com">
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <PipedreamIcon />,
        name: 'Pipedream',
        description: t('pipedream.description'),
      },
      {
        id: 'exa',
        baseUrl: 'https://mcp.exa.ai',
        setup: {
          type: 'custom-url',
          baseUrl: 'https://mcp.exa.ai/mcp?exaApiKey=your-exa-api-key',
          requiresApiKey: false,
          hideApiKeyField: true,
          placeholder: 'https://mcp.exa.ai/mcp?exaApiKey=your-exa-api-key',
          instructions: t.rich('exa.instructions', {
            link: (chunks) => (
              <Link
                target="_blank"
                href="https://docs.exa.ai/integrations/mcp-server"
              >
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <ExaIcon />,
        name: 'Exa',
        description: t('exa.description'),
      },
      {
        id: 'huggingface',
        baseUrl: 'https://huggingface.co',
        setup: {
          type: 'custom-url',
          baseUrl: 'https://huggingface.co/mcp',
          requiresApiKey: false,
          instructions: t.rich('huggingface.instructions', {
            link: (chunks) => (
              <Link target="_blank" href="https://huggingface.co/mcp">
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <HuggingFaceIcon />,
        name: 'Hugging Face',
        description: t('huggingface.description'),
      },
      {
        id: 'composio',
        baseUrl: 'https://mcp.composio.dev',
        setup: {
          type: 'custom-url',
          baseUrl: '',
          requiresApiKey: false,
          requiresServerUrl: true,
          instructions: t.rich('composio.instructions', {
            link: (chunks) => (
              <Link target="_blank" href="https://mcp.composio.dev">
                {chunks}
              </Link>
            ),
          }),
        },
        logo: <ComposioLogoMarkDynamic />,
        name: 'Composio',
        description: t('composio.description'),
      },
    ];

    return enabled ? recommendedServers : [];
  }, [t, enabled]);
}
