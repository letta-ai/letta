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

interface FreeMCPServerDialogProps {
  server: CustomUrlRecommendedServer;
}

export function FreeMCPServerDialog(props: FreeMCPServerDialogProps) {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');

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

  const serverUrl = props.server.setup?.baseUrl;
  const handleAddServer = useCallback(() => {
    const requestBody = {
      server_name: serverName,
      type: 'streamable_http' as const,
      server_url: serverUrl,
      auth_header: null,
      auth_token: null,
      custom_headers: null,
    };

    mutate({ requestBody });
  }, [mutate, serverName, serverUrl]);

  if (!serverUrl) return null;

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={
          isError ? t('OpenAccessMCPServer.errorMessage') : undefined
        }
        title={props.server.name}
        onSubmit={handleAddServer}
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
