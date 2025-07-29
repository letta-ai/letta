'use client';
import {
  ActionCard,
  NiceGridDisplay,
  PlusIcon,
  VStack,
  HStack,
  RawInput,
  SearchIcon,
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

function ServerSetupDialog({ server }: { server: CustomUrlRecommendedServer }) {
  const config = SERVER_CONFIGS[server.id];
  if (!config) return null;

  // For now, return the existing components based on server type
  if (server.id === 'pipedream') {
    return <CustomSetupServer server={server} />;
  }
  if (server.id === 'deepwiki' || server.id === 'huggingface') {
    return <FreeMCPServerDialog server={server} />;
  }
  if (server.id === 'github') {
    return <GitHubSetupServer server={server} />;
  }

  // Default to StreamableHttpSetupServer for all other servers
  return <StreamableHttpSetupServer server={server} />;
}

export function MCPServerExplorer() {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');
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
      <VStack gap="large" paddingX="xlarge" paddingBottom="xlarge">
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
