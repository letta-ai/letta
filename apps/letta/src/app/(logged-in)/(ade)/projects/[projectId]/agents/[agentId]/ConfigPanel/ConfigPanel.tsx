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
import { useCurrentAgent, useCurrentTestingAgentId } from '../hooks';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import { useDebouncedValue } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useCurrentTestingAgent } from '../hooks/useCurrentTestingAgent/useCurrentTestingAgent';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2Icon } from 'lucide-react';

function EditAgentName() {
  const { name: defaultName } = useCurrentTestingAgent();

  const [name, setName] = useState(defaultName);
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const testingAgentId = useCurrentTestingAgentId();

  const [debouncedName] = useDebouncedValue(name, 500);
  const { mutate, isPending } =
    webApi.projects.updateProjectTestingAgent.useMutation({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjectTestingAgent(
            projectId,
            testingAgentId
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
        testingAgentId,
      },
    });
  }, [debouncedName, mutate, projectId, testingAgentId]);

  return (
    <RawInput
      fullWidth
      label="Agent Name"
      autoComplete="off"
      data-lpignore="true"
      data-form-type="other"
      value={name}
      onChange={(event) => {
        setName(event.currentTarget.value);
      }}
      isUpdating={isPending}
    />
  );
}

function DeleteAgentDialog() {
  const { name } = useCurrentTestingAgent();

  const projectId = useCurrentProjectId();
  const testingAgentId = useCurrentTestingAgentId();

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
    webApi.projects.deleteProjectTestingAgent.useMutation({
      onSuccess: () => {
        window.location.href = `/projects/${projectId}`;
      },
    });

  const handleSubmit = useCallback(() => {
    mutate({
      params: {
        projectId,
        testingAgentId,
      },
    });
  }, [mutate, projectId, testingAgentId]);

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

export function ConfigPanel() {
  const { id } = useCurrentAgent();

  return (
    <Panel
      title="Settings"
      id="settings"
      trigger={<ADENavigationItem icon={<Settings2Icon />} title="Settings" />}
    >
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
              Any staged or deployed agents generated from this agent will not
              be deleted.
            </Typography>
            <HStack fullWidth justify="end">
              <DeleteAgentDialog />
            </HStack>
          </VStack>
        </Card>
      </PanelMainContent>
    </Panel>
  );
}
