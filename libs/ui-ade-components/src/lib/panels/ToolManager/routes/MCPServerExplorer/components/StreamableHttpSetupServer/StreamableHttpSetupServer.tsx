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

interface StreamableHttpSetupServerProps {
  server: CustomUrlRecommendedServer;
}

export function StreamableHttpSetupServer(
  props: StreamableHttpSetupServerProps,
) {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');

  const streamableHttpSchema = z.object({
    serverUrl: z
      .string()
      .url()
      .min(1, t('StreamableHttpSetupServer.serverUrlRequired')),
    authMode: z.string().default(AuthModes.API_KEY),
    authToken: z.string().min(1, t('StreamableHttpSetupServer.apiKeyRequired')),
    customHeaders: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .default([]),
  });

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
        authToken: data.authToken,
        customHeaders: data.customHeaders,
        options: { formatToken: true, includeAuthHeader: true },
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
                content={t('ApiKeyRequiredMCPServer.apiKeyLabel')}
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
