import type { PanelTemplate } from '@letta-web/component-library';
import { Form } from '@letta-web/component-library';
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
import React, { useCallback, useMemo } from 'react';
import { useCurrentAgent } from '../hooks';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { useCurrentAgentTemplate } from '../hooks/useCurrentAgentTemplate/useCurrentAgentTemplate';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2Icon } from 'lucide-react';

const updateNameFormSchema = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'Name must be alphanumeric, with underscores or dashes',
    })
    .min(3, { message: 'Name must be at least 3 characters long' })
    .max(25, { message: 'Name must be at most 25 characters long' }),
});

type UpdateNameFormValues = z.infer<typeof updateNameFormSchema>;

function EditAgentName() {
  const { name: defaultName } = useCurrentAgentTemplate();

  const form = useForm({
    resolver: zodResolver(updateNameFormSchema),
    defaultValues: {
      name: defaultName,
    },
  });

  const { id: projectId } = useCurrentProject();
  const queryClient = useQueryClient();
  const { name, id: agentTemplateId } = useCurrentAgentTemplate();

  const { mutate, isPending } =
    webApi.projects.updateProjectAgentTemplate.useMutation({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getTestingAgentByIdOrName(name),
        });
      },
    });

  const handleSubmit = useCallback(
    (values: UpdateNameFormValues) => {
      mutate({
        body: { name: values.name },
        params: {
          projectId,
          agentTemplateId,
        },
      });
    },
    [mutate, projectId, agentTemplateId]
  );

  return (
    <Card>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          <VStack fullWidth align="start">
            <HStack fullWidth align="start">
              <FormField
                name="name"
                render={({ field }) => (
                  <Input
                    fullWidth
                    description="Updating the name of your agent will update all references to this agent in your project."
                    label="Agent Name"
                    {...field}
                  />
                )}
              />
            </HStack>
            <HStack fullWidth justify="end">
              <Button
                type="submit"
                color="secondary"
                label="Update Agent Name"
                busy={isPending}
              />
            </HStack>
          </VStack>
        </Form>
      </FormProvider>
    </Card>
  );
}

function DeleteAgentDialog() {
  const { name } = useCurrentAgentTemplate();

  const { id: projectId, slug: projectSlug } = useCurrentProject();
  const { id: agentTemplateId } = useCurrentAgentTemplate();

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
        window.location.href = `/projects/${projectSlug}`;
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
      <RawInput fullWidth label="Agent ID" allowCopy defaultValue={id} />
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
