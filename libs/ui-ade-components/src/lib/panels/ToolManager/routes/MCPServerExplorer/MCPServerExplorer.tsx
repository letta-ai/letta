'use client';
import {
  ActionCard,
  NiceGridDisplay,
  PlusIcon,
  VStack,
  HStack,
  RawInput,
  SearchIcon,
  McpIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useState, useMemo } from 'react';
import { AddServerDialog } from '../MCPServers/AddMCPServerDialog/AddMCPServerDialog';
import type { CustomUrlRecommendedServer } from './hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import { useRecommendedMCPServers } from './hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import {
  GitHubSetupServer,
  CustomSetupServer,
  FreeMCPServerDialog,
  StreamableHttpSetupServer,
} from './components';
import { SERVER_CONFIGS } from './constants';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';
import { useRouter, usePathname } from 'next/navigation';

function ServerSetupDialog({ server }: { server: CustomUrlRecommendedServer }) {
  const config = SERVER_CONFIGS[server.id];
  if (!config) return null;

  // Use the auth type to determine which component to use
  switch (config.auth) {
    case 'server_url':
      return <CustomSetupServer server={server} />;
    case 'none':
      return <FreeMCPServerDialog server={server} />;
    case 'custom_headers':
      return <GitHubSetupServer server={server} />;
    case 'api_key':
    default:
      return <StreamableHttpSetupServer server={server} />;
  }
}

function useContextAwareNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const toolManagerState = useToolManagerState();
  const isInToolsPages = pathname.startsWith('/tools');

  function navigateToMCPServers() {
    if (isInToolsPages) {
      router.push('/tools/mcp-servers');
    } else {
      toolManagerState.setPath('/mcp-servers');
    }
  }

  return { navigateToMCPServers };
}

export function MCPServerExplorer() {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');
  const { navigateToMCPServers } = useContextAwareNavigation();
  const recommendedServers = useRecommendedMCPServers();
  const [search, setSearch] = useState('');

  const filteredServers = useMemo(() => {
    if (!search.trim()) {
      return recommendedServers;
    }

    const searchLower = search.toLowerCase();
    return recommendedServers.filter((server) => {
      const name = server.name?.toLowerCase() || '';
      const description = server.description?.toLowerCase() || '';
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [recommendedServers, search]);

  return (
    <VStack
      paddingTop="xsmall"
      fullHeight
      overflow="hidden"
      fullWidth
      gap={false}
    >
      <VStack
        gap="large"
        paddingX="xlarge"
        paddingBottom="xlarge"
        overflowY="auto"
        fullHeight
      >
        <HStack>
          <HStack border fullWidth>
            <RawInput
              preIcon={<SearchIcon />}
              placeholder={t('search.placeholder')}
              label={t('search.label')}
              hideLabel
              fullWidth
              color="transparent"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </HStack>
        </HStack>
        <NiceGridDisplay>
          <ActionCard
            icon={<McpIcon />}
            title={t('types.connected.label')}
            description={t('types.connected.description')}
            onClick={navigateToMCPServers}
          />
          <AddServerDialog
            trigger={
              <ActionCard
                icon={<PlusIcon />}
                title={t('types.custom.label')}
                description={t('types.custom.description')}
              />
            }
          />
          {filteredServers.map((server) => {
            // Use the new unified component for all servers
            return (
              <ServerSetupDialog
                key={server.id}
                server={server as CustomUrlRecommendedServer}
              />
            );
          })}
        </NiceGridDisplay>
      </VStack>
    </VStack>
  );
}
