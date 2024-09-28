import type { PanelTemplate } from '@letta-web/component-library';
import {
  Button,
  Card,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  Input,
  Panel,
  PanelMainContent,
  RawInput,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentAgent, useCurrentAgentId } from '../hooks';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import { useDebouncedValue } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useCurrentAgentTemplate } from '../hooks/useCurrentAgentTemplate/useCurrentAgentTemplate';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2Icon } from 'lucide-react';

function EditAgentName() {
  const { name: defaultName } = useCurrentAgentTemplate();

  const [name, setName] = useState(defaultName);
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const agentTemplateId = useCurrentAgentId();

  const [debouncedName] = useDebouncedValue(name, 500);
  const { mutate, isPending } =
    webApi.projects.updateProjectAgentTemplate.useMutation({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjectAgentTemplate(
            projectId,
            agentTemplateId
          ),
        });
      },
    });

  useEffect(() => {
    if (!debouncedName) {
      return;
    }

    mutate({
      body: { name: debouncedName },
      params: {
        projectId,
        agentTemplateId,
      },
    });
  }, [debouncedName, mutate, projectId, agentTemplateId]);

  return (
    <RawInput
      fullWidth
      label="Agent Name"
      value={name}
      onChange={(event) => {
        setName(event.currentTarget.value);
      }}
      isUpdating={isPending}
    />
  );
}

function DeleteAgentDialog() {
  const { name } = useCurrentAgentTemplate();

  const projectId = useCurrentProjectId();
  const agentTemplateId = useCurrentAgentId();

  const DeleteAgentDialogFormSchema = useMemo(
    () =>
      z.object({
        agentName: z.literal(name, {
          message: 'Agent name does not match',
        }),
      }),
    [name]
  );

  const form = useForm<z.infer<typeof DeleteAgentDialogFormSchema>>({
    resolver: zodResolver(DeleteAgentDialogFormSchema),
    defaultValues: {
      agentName: '',
    },
  });

  const { mutate, isPending } =
    webApi.projects.deleteProjectAgentTemplate.useMutation({
      onSuccess: () => {
        window.location.href = `/projects/${projectId}`;
      },
    });

  const handleSubmit = useCallback(() => {
    mutate({
      params: {
        projectId,
        agentTemplateId,
      },
    });
  }, [mutate, projectId, agentTemplateId]);

  return (
    <FormProvider {...form}>
      <Dialog
        confirmColor="destructive"
        confirmText="Delete Agent"
        title="Are you sure you want to delete this agent?"
        trigger={<Button label="Delete Agent" color="destructive" />}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
      >
        <Typography>
          This action cannot be undone. All data associated with this agent will
          be permanently deleted.
        </Typography>
        <Typography>
          Your agent{"'"}s name is:
          <br />
          <strong>{name}</strong>
        </Typography>
        <FormField
          name="agentName"
          render={({ field }) => (
            <Input
              fullWidth
              label={`Type the name of the agent name confirm`}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

function ConfigPanel() {
  const { id } = useCurrentAgent();

  return (
    <PanelMainContent>
      <RawInput fullWidth label="SDK Agent ID" allowCopy defaultValue={id} />
      <EditAgentName />
      <Card>
        <VStack fullWidth>
          <Typography bold>Delete agent</Typography>
          <Typography>
            Deleting an agent will permanently remove this agent from your
            project. It is not-recoverable.
          </Typography>
          <Typography>
            Any staged or deployed agents generated from this agent will not be
            deleted.
          </Typography>
          <HStack fullWidth justify="end">
            <DeleteAgentDialog />
          </HStack>
        </VStack>
      </Card>
    </PanelMainContent>
  );
}

export function ConfigPanelWrapped() {
  return (
    <Panel
      title="Settings"
      id="settings"
      trigger={<ADENavigationItem icon={<Settings2Icon />} title="Settings" />}
    >
      <ConfigPanel />
    </Panel>
  );
}

export const configPanelTemplate = {
  templateId: 'agent-config',
  content: ConfigPanel,
  title: 'Settings',
  data: z.undefined(),
} satisfies PanelTemplate<'agent-config'>;
