'use client';

import { useCallback } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ActionCard,
  Alert,
  Badge,
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { TestMCPConnectionButton } from '../../../MCPServers/TestMCPConnectionButton';
import { MCPServerTypes } from '../../../MCPServers/types';
import { AuthModes } from '../../../MCPServers/AuthenticationSection';
import { formatAuthToken } from '../../../MCPServers/utils';
import { useMCPServerDialog } from '../../hooks/useMCPServerDialog/useMCPServerDialog';
import type { CustomUrlRecommendedServer } from '../../hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface GitHubSetupServerProps {
  server: CustomUrlRecommendedServer;
}

export function GitHubSetupServer(props: GitHubSetupServerProps) {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');

  const githubSchema = z.object({
    serverUrl: z
      .string()
      .url()
      .min(1, t('GitHubSetupServer.serverUrlRequired')),
    authMode: z.string().default(AuthModes.API_KEY),
    authToken: z.string().min(1, t('GitHubSetupServer.apiKeyRequired')),
    customHeaders: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .default([]),
  });

  const form = useForm({
    resolver: zodResolver(githubSchema),
    defaultValues: {
      serverUrl: props.server.setup.baseUrl || '',
      authMode: AuthModes.API_KEY,
      authToken: '',
      customHeaders: [],
    },
  });

  const { open, mutate, isPending, isError, handleOpenChange, serverName } =
    useMCPServerDialog(props.server);

  type GitHubFormValues = z.infer<typeof githubSchema>;

  const handleSubmit = useCallback(
    (data: GitHubFormValues) => {
      // Use custom_headers format as per GitHub MCP documentation
      const authToken = formatAuthToken(data.authToken);
      if (!authToken) {
        console.error('Missing API key');
        return;
      }

      const customHeaders = {
        Authorization: authToken,
      };

      trackClientSideEvent(AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT, {
        mcp_server_name: serverName,
        mcp_server_type: MCPServerTypes.StreamableHttp,
      });

      const requestBody = {
        server_name: serverName, // Use the generated name
        type: 'streamable_http' as const,
        server_url: data.serverUrl,
        auth_header: null,
        auth_token: null,
        custom_headers: customHeaders,
      };

      mutate({
        requestBody,
      });
    },
    [serverName, mutate], // Add serverName to dependencies
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('GitHubSetupServer.errorMessage') : undefined}
        title={props.server.name}
        onSubmit={form.handleSubmit(handleSubmit)}
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
                variant="info"
                content={t('PatKeyRequiredMCPServer.patKeyLabel')}
                size="small"
                border
              />
            }
          />
        }
      >
        <FormField
          name="serverUrl"
          render={({ field }) => (
            <Input
              fullWidth
              placeholder={t('GitHubSetupServer.serverUrlPlaceholder')}
              label={t('GitHubSetupServer.serverUrlLabel')}
              {...field}
            />
          )}
        />
        <FormField
          name="authToken"
          render={({ field }) => (
            <Input
              fullWidth
              type="password"
              placeholder={t('GitHubSetupServer.apiKeyPlaceholder')}
              label={t('GitHubSetupServer.apiKeyLabel')}
              {...field}
            />
          )}
        />
        <TestMCPConnectionButton
          serverType={MCPServerTypes.StreamableHttp}
          data-testid="github-test-connection"
        />

        <Alert title={t('GitHubSetupServer.instructionsTitle')}>
          {props.server.setup.instructions}
        </Alert>
      </Dialog>
    </FormProvider>
  );
}
