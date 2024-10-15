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
  PanelMainContent,
  RawInput,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useCurrentAgent } from '../hooks';
import { webOriginSDKApi } from '$letta/client';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { isFetchError } from '@ts-rest/react-query/v5';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';

const updateNameFormSchema = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'Name must be alphanumeric, with underscores or dashes',
    })
    .min(3, { message: 'Name must be at least 3 characters long' })
    .max(50, { message: 'Name must be at most 50 characters long' }),
});

type UpdateNameFormValues = z.infer<typeof updateNameFormSchema>;

function EditAgentName() {
  const { agentName, isTemplate } = useCurrentAgentMetaData();
  const { slug: projectSlug } = useCurrentProject();

  const form = useForm({
    resolver: zodResolver(updateNameFormSchema),
    defaultValues: {
      name: agentName,
    },
  });

  const { id: agentTemplateId } = useCurrentAgent();

  const { mutate, isPending, error } =
    webOriginSDKApi.agents.updateAgent.useMutation();

  const handleSubmit = useCallback(
    (values: UpdateNameFormValues) => {
      mutate(
        {
          body: { name: values.name, id: agentTemplateId },
          params: {
            agent_id: agentTemplateId,
          },
        },
        {
          onSuccess: async () => {
            if (isTemplate) {
              window.location.href = `/projects/${projectSlug}/templates/${values.name}`;
            } else {
              window.location.href = `/projects/${projectSlug}/agents/${agentTemplateId}`;
            }
          },
        }
      );
    },
    [mutate, agentTemplateId, isTemplate, projectSlug]
  );

  useEffect(() => {
    if (error && !isFetchError(error)) {
      if (error.status === 409) {
        form.setError('name', {
          message: 'An agent with the same name already exists',
        });
      }
    }
  }, [error, form]);

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
                color="primary"
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
  const { name } = useCurrentAgent();

  const { slug: projectSlug } = useCurrentProject();
  const { id: agentTemplateId } = useCurrentAgent();

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

  const { mutate, isPending } = webOriginSDKApi.agents.deleteAgent.useMutation({
    onSuccess: () => {
      window.location.href = `/projects/${projectSlug}`;
    },
  });

  const handleSubmit = useCallback(() => {
    mutate({
      params: {
        agent_id: agentTemplateId,
      },
    });
  }, [mutate, agentTemplateId]);

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

export const configPanelTemplate = {
  templateId: 'agent-config',
  content: ConfigPanel,
  useGetTitle: () => 'Agent Config',
  data: z.undefined(),
} satisfies PanelTemplate<'agent-config'>;
