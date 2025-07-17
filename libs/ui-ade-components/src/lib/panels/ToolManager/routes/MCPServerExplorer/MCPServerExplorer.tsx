'use client';
import {
  ActionCard,
  NiceGridDisplay,
  PlusIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
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

  return (
    <VStack
      paddingTop="medium"
      fullHeight
      overflow="hidden"
      fullWidth
      gap={false}
    >
      <VStack gap="large" paddingX="xlarge" paddingBottom="xlarge">
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
          {recommendedServers.map((server) => {
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
