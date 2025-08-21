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
import { useToolsServiceListMcpServers } from '@letta-cloud/sdk-core';
import { TestMCPConnectionButton } from '../../../MCPServers/TestMCPConnectionButton';
import { MCPServerTypes } from '../../../MCPServers/types';
import { generateServerName } from '../../../MCPServers/AddMCPServerDialog/AddMCPServerDialog';
import { useMCPServerDialog } from '../../hooks/useMCPServerDialog';
import type { CustomUrlRecommendedServer } from '../../hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import { SERVER_CONFIGS } from '../../constants';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface CustomSetupServerProps {
  server: CustomUrlRecommendedServer;
}

export function CustomSetupServer(props: CustomSetupServerProps) {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');
  const config = SERVER_CONFIGS[props.server.id];

  const customInputSchema = z.object({
    input: z
      .string()
      .url()
      .min(1, t('CustomSetupServer.customUrlInputRequired')),
  });

  const form = useForm({
    resolver: zodResolver(customInputSchema),
    defaultValues: {
      input: '',
    },
  });

  const { data: existingServers } = useToolsServiceListMcpServers();
  const { open, mutate, isPending, isError, handleOpenChange } =
    useMCPServerDialog(props.server);

  type CustomInputFormValues = z.infer<typeof customInputSchema>;

  const { watch } = form;
  const watchedInput = watch('input');

  const handleSubmit = useCallback(
    (data: CustomInputFormValues) => {
      let baseName = props.server.name;
      const serverType = config?.type || 'sse';

      if (data.input.includes('mcp.pipedream.net')) {
        const urlParts = data.input.split('/');
        const appName = urlParts[urlParts.length - 1];
        baseName = `${appName.charAt(0).toUpperCase() + appName.slice(1)} (Pipedream)`;
      }
      const serverName = generateServerName(baseName, existingServers);

      trackClientSideEvent(AnalyticsEvent.ADD_MCP_SERVER, {
        mcp_server_name: serverName,
        mcp_server_type: serverType,
      });

      const requestBody = {
        server_name: serverName,
        type: serverType,
        server_url: data.input,
        auth_header: null,
        auth_token: null,
        custom_headers: null,
      };

      mutate({ requestBody });
    },
    [props.server.name, config?.type, existingServers, mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? t('CustomSetupServer.errorMessage') : undefined}
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
              props.server.setup.requiresApiKey ? (
                <Badge
                  variant="chipUsageBased"
                  content={t('ApiKeyRequiredMCPServer.apiKeyLabel')}
                  size="small"
                  border
                />
              ) : props.server.setup.requiresServerUrl ? (
                <Badge
                  variant="info"
                  content={t('ServerUrlRequiredMCPServer.serverUrlLabel')}
                  size="small"
                  border
                />
              ) : undefined
            }
          />
        }
      >
        <FormField
          name="input"
          render={({ field }) => (
            <Input
              fullWidth
              placeholder={t('CustomSetupServer.customUrlInputPlaceholder')}
              label={t('CustomSetupServer.customUrlInputLabel')}
              {...field}
            />
          )}
        />
        <TestMCPConnectionButton
          serverType={
            config?.type === 'streamable_http'
              ? MCPServerTypes.StreamableHttp
              : MCPServerTypes.Sse
          }
          data-testid={`test-connection-${watchedInput}`}
        />
        <Alert title={t('CustomSetupServer.instructionsTitle')}>
          {props.server.setup.instructions}
        </Alert>
      </Dialog>
    </FormProvider>
  );
}
