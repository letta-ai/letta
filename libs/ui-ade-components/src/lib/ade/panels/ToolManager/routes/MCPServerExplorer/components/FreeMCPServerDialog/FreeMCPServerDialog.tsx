'use client';

import { useCallback } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ActionCard,
  Alert,
  Badge,
  Dialog,
  FormProvider,
  VStack,
  useForm,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { TestMCPConnectionButton } from '../../../MCPServers/TestMCPConnectionButton';
import { MCPServerTypes } from '../../../MCPServers/types';
import { AuthModes } from '../../../MCPServers/AuthenticationSection';
import { useMCPServerDialog } from '../../hooks/useMCPServerDialog/useMCPServerDialog';
import type { CustomUrlRecommendedServer } from '../../hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useCurrentAgentMetaData } from '../../../../../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';

interface FreeMCPServerDialogProps {
  server: CustomUrlRecommendedServer;
}

export function FreeMCPServerDialog(props: FreeMCPServerDialogProps) {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');

  const { agentId } = useCurrentAgentMetaData();

  // Create a minimal form context for the test button
  const freeServerSchema = z.object({
    serverUrl: z.string().url(),
    authMode: z.string().default(AuthModes.NONE),
    authToken: z.string().default(''),
    customHeaders: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .default([]),
  });

  const form = useForm({
    resolver: zodResolver(freeServerSchema),
    defaultValues: {
      serverUrl: props.server?.setup?.baseUrl || '',
      authMode: AuthModes.NONE,
      authToken: '',
      customHeaders: [],
    },
  });

  const { mutate, isPending, isError, serverName, open, handleOpenChange } =
    useMCPServerDialog(props.server);

  const handleAddServer = useCallback(
    (formData: z.infer<typeof freeServerSchema>) => {
      trackClientSideEvent(AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT, {
        agent_id: agentId,
        mcp_server_name: serverName,
        mcp_server_type: MCPServerTypes.StreamableHttp, // TODO: change this after we expand support for free mcp server
      });

      const requestBody = {
        server_name: serverName,
        type: 'streamable_http' as const, // NOTE: this is only for hugging face and deepwiki
        server_url: formData.serverUrl,
        auth_header:
          formData.authMode === AuthModes.NONE ? null : formData.authMode,
        auth_token: formData.authToken || null,
        custom_headers:
          formData.customHeaders.length > 0
            ? Object.fromEntries(
                formData.customHeaders.map((h) => [h.key, h.value]),
              )
            : null,
      };

      mutate({ requestBody });
    },
    [mutate, serverName, agentId],
  );

  const serverUrl = props.server.setup?.baseUrl;
  if (!serverUrl) return null;

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={
          isError ? t('OpenAccessMCPServer.errorMessage') : undefined
        }
        title={props.server.name}
        onSubmit={form.handleSubmit(handleAddServer)}
        isConfirmBusy={isPending}
        isOpen={open}
        onOpenChange={handleOpenChange}
        trigger={
          <ActionCard
            icon={props.server.logo}
            title={props.server.name}
            description={props.server.description}
            actions={
              <Badge
                variant="success"
                content={t('OpenAccessMCPServer.openLabel')}
                size="small"
                border
              />
            }
          />
        }
      >
        <VStack gap="medium">
          <Alert variant="info" title="Open Access">
            This is a free service that doesn&apos;t require any API keys or
            authentication.
          </Alert>

          <TestMCPConnectionButton serverType={MCPServerTypes.StreamableHttp} />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
