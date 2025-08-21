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
import { parseAuthenticationData } from '../../../MCPServers/utils';
import { useMCPServerDialog } from '../../hooks/useMCPServerDialog/useMCPServerDialog';
import type { CustomUrlRecommendedServer } from '../../hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface StreamableHttpSetupServerProps {
  server: CustomUrlRecommendedServer;
}

export function StreamableHttpSetupServer(
  props: StreamableHttpSetupServerProps,
) {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');

  // Create dynamic schema based on server configuration
  function createSchema() {
    const baseSchema = {
      serverUrl: z
        .string()
        .url()
        .min(1, t('StreamableHttpSetupServer.serverUrlRequired')),
      authMode: z.string().default(AuthModes.API_KEY),
      customHeaders: z
        .array(z.object({ key: z.string(), value: z.string() }))
        .default([]),
    };

    // If server requires custom URLs, make API token optional when URL differs from base
    if (props.server.setup.requiresServerUrl) {
      return z.object({
        ...baseSchema,
        authToken: z
          .string()
          .optional()
          .refine(
            (val) => {
              // Get the current form values to access serverUrl
              const formValues = form.getValues();
              const serverUrl = formValues.serverUrl;
              const baseUrl = props.server.setup.baseUrl;

              // If using the default base URL, API token is required
              if (serverUrl === baseUrl && props.server.setup.requiresApiKey) {
                return (
                  (val && val.length > 0) ||
                  t('StreamableHttpSetupServer.apiKeyRequired')
                );
              }

              // If using a custom URL, API token is optional
              return true;
            },
            {
              message: t('StreamableHttpSetupServer.apiKeyRequired'),
            },
          ),
      });
    }

    // Default behavior: API token required if server requires it
    return z.object({
      ...baseSchema,
      authToken: props.server.setup.requiresApiKey
        ? z.string().min(1, t('StreamableHttpSetupServer.apiKeyRequired'))
        : z.string().optional(),
    });
  }

  const streamableHttpSchema = createSchema();

  const form = useForm({
    resolver: zodResolver(streamableHttpSchema),
    defaultValues: {
      serverUrl: props.server.setup.baseUrl || '',
      authMode: AuthModes.API_KEY,
      authToken: '',
      customHeaders: [],
    },
  });

  const { open, mutate, isPending, isError, handleOpenChange, serverName } =
    useMCPServerDialog(props.server);

  type StreamableHttpFormValues = z.infer<typeof streamableHttpSchema>;

  const { watch } = form;
  const watchedServerUrl = watch('serverUrl');
  const watchedAuthToken = watch('authToken');

  const handleSubmit = useCallback(
    (data: StreamableHttpFormValues) => {
      const { authHeaders, authHeader, authToken } = parseAuthenticationData({
        authMode: data.authMode,
        authToken: data.authToken || '', // Handle optional auth token
        customHeaders: data.customHeaders,
        options: { formatToken: true, includeAuthHeader: true },
      });

      trackClientSideEvent(AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT, {
        mcp_server_name: serverName,
        mcp_server_type: MCPServerTypes.StreamableHttp,
      });

      const requestBody = {
        server_name: serverName,
        type: 'streamable_http' as const,
        server_url: data.serverUrl,
        auth_header: authHeader,
        auth_token: authToken,
        custom_headers: authHeaders,
      };

      mutate({
        requestBody,
      });
    },
    [serverName, mutate],
  );

  // Determine if API token input should be shown based on current URL
  const isApiTokenInputVisible =
    watchedServerUrl === props.server.setup.baseUrl;

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={
          isError ? t('StreamableHttpSetupServer.errorMessage') : undefined
        }
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
                content={
                  isApiTokenInputVisible
                    ? t('ApiKeyRequiredMCPServer.apiKeyLabel')
                    : t('StreamableHttpSetupServer.customUrlLabel')
                }
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
              placeholder={t('StreamableHttpSetupServer.serverUrlPlaceholder')}
              label={t('StreamableHttpSetupServer.serverUrlLabel')}
              {...field}
            />
          )}
        />
        {isApiTokenInputVisible && (
          <FormField
            name="authToken"
            render={({ field }) => (
              <Input
                fullWidth
                type="password"
                placeholder={t('StreamableHttpSetupServer.apiKeyPlaceholder')}
                label={t('StreamableHttpSetupServer.apiKeyLabel')}
                {...field}
              />
            )}
          />
        )}
        <TestMCPConnectionButton
          serverType={MCPServerTypes.StreamableHttp}
          data-testid={`test-connection-${watchedServerUrl}-${watchedAuthToken?.length}`}
        />
        <Alert title={t('StreamableHttpSetupServer.instructionsTitle')}>
          {props.server.setup.instructions}
        </Alert>
      </Dialog>
    </FormProvider>
  );
}
