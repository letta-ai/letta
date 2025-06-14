import {
  ActionCard,
  Alert,
  Dialog,
  FormField,
  FormProvider,
  Input,
  NiceGridDisplay,
  PlusIcon,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ToolManagerPage } from '../../components/ToolManagerPage/ToolManagerPage';
import { useTranslations } from '@letta-cloud/translations';
import { AddServerDialog } from '../MCPServers/AddMCPServerDialog/AddMCPServerDialog';
import type { CustomUrlRecommendedServer } from './hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import { useRecommendedMCPServers } from './hooks/useRecommendedMCPServers/useRecommendedMCPServers';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import {
  type ListMcpServersResponse,
  useToolsServiceAddMcpServer,
  UseToolsServiceListMcpServersKeyFn,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';

interface CustomSetupServerProps {
  server: CustomUrlRecommendedServer;
}

function CustomSetupServer(props: CustomSetupServerProps) {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');
  const { setPath } = useToolManagerState();

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

  const [open, setOpen] = useState(false);

  const { name } = props.server;

  type CustomInputFormValues = z.infer<typeof customInputSchema>;

  const queryClient = useQueryClient();

  const { mutate, isPending, isError, reset } = useToolsServiceAddMcpServer({
    onSuccess: (response) => {
      queryClient.setQueriesData<ListMcpServersResponse | undefined>(
        {
          queryKey: UseToolsServiceListMcpServersKeyFn(),
        },
        () => {
          return response.reduce((acc, item) => {
            acc[item.server_name] = item;
            return acc;
          }, {} as ListMcpServersResponse);
        },
      );

      setOpen(false);

      setPath('/mcp-servers');
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open);
      if (!open) {
        form.reset();
        reset();
        form.clearErrors();
      }
    },
    [form, reset],
  );

  const handleSubmit = useCallback(
    (data: CustomInputFormValues) => {
      mutate({
        requestBody: {
          server_name: name,
          type: 'sse',
          server_url: data.input,
        },
      });
    },
    [name, mutate],
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
        <Alert title={t('CustomSetupServer.instructionsTitle')}>
          {props.server.setup.instructions}
        </Alert>
      </Dialog>
    </FormProvider>
  );
}

export function MCPServerExplorer() {
  const t = useTranslations('ToolsEditor/MCPServerExplorer');

  const recommendedServers = useRecommendedMCPServers();

  return (
    <ToolManagerPage>
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
                ></ActionCard>
              }
            />
            {recommendedServers.map((server) => {
              if (server.setup.type === 'custom-url') {
                return (
                  <CustomSetupServer
                    key={server.id}
                    server={server as CustomUrlRecommendedServer}
                  />
                );
              }

              return null;
            })}
          </NiceGridDisplay>
        </VStack>
      </VStack>
    </ToolManagerPage>
  );
}
