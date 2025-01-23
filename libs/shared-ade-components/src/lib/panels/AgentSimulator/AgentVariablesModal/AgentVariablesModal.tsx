import {
  Alert,
  Button,
  Dialog,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  KeyValueEditor,
  LettaLoader,
  RawKeyValueEditor,
  Skeleton,
  TabGroup,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../hooks';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { Link } from '@letta-cloud/component-library';
import {
  getIsAgentState,
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyAgent,
  webOriginSDKApi,
  webOriginSDKQueryKeys,
} from '@letta-cloud/letta-agents-api';
import type { AgentState } from '@letta-cloud/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { atom, useAtom } from 'jotai';
import {
  type GetAgentTemplateSimulatorSessionResponseBody,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/web-api-client';
import { findMemoryBlockVariables } from '@letta-cloud/generic-utils';
import { useCurrentSimulatedAgent } from '../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';

function useAgentVariables() {
  const { isFromTemplate } = useCurrentAgentMetaData();
  const { id: agentId } = useCurrentAgent();
  return webOriginSDKApi.agents.getAgentVariables.useQuery({
    queryKey: webOriginSDKQueryKeys.agents.getAgentVariables(agentId),
    queryData: {
      params: {
        agent_id: agentId,
      },
    },
    enabled: isFromTemplate,
  });
}

function DeployedAgentVariables() {
  const t = useTranslations('ADE/AgentVariablesModal');
  const { data } = useAgentVariables();

  const variableList = useMemo(() => {
    return Object.entries(data?.body.variables || {}) || [];
  }, [data]);

  if (!data) {
    return (
      <HStack borderBottom padding="small">
        <Skeleton
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-full h-[30px]"
        />
        <Skeleton
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-full h-[30px]"
        />
      </HStack>
    );
  }

  if (!variableList.length) {
    return (
      <HStack padding="small">
        <Alert title={t('noVariablesInDeployedAgent')} variant="info" />
      </HStack>
    );
  }

  return (
    <RawKeyValueEditor
      label={t('DeployedAgentVariables.label')}
      hideLabel
      fullWidth
      disabled
      value={variableList.map(([variable, value]) => ({
        key: variable,
        value,
      }))}
    />
  );
}

type VariableDisplayMode = 'environment' | 'memories';

function ToolVariables() {
  const t = useTranslations('ADE/AgentVariablesModal');
  const { tool_exec_environment_variables, id: agentId } = useCurrentAgent();
  const { isTemplate } = useCurrentAgentMetaData();
  const environmentVariableFormState = z.object({
    variables: z.array(
      z.object({
        key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
          message: t('ToolVariables.keyError'),
        }),
        value: z.string(),
      }),
    ),
  });

  type EnvironmentVariableFormState = z.infer<
    typeof environmentVariableFormState
  >;

  const [_, setModalState] = useAtom(agentVariableModalState);

  const queryClient = useQueryClient();

  const { mutate, isPending } = useAgentsServiceModifyAgent({
    onSuccess: (data) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tool_exec_environment_variables:
              data.tool_exec_environment_variables,
          };
        },
      );

      setModalState(false);
    },
  });

  const { isLocal } = useCurrentAgentMetaData();

  const form = useForm<EnvironmentVariableFormState>({
    resolver: zodResolver(environmentVariableFormState),
    defaultValues: {
      variables: tool_exec_environment_variables,
    },
  });

  const handleSubmit = useCallback(
    (values: EnvironmentVariableFormState) => {
      const updatedVariables = values.variables
        .filter(({ key }) => key)
        .map(({ key, value }) => [key, value]);

      mutate({
        agentId,
        requestBody: {
          tool_exec_environment_variables: Object.fromEntries(updatedVariables),
        },
      });
    },
    [agentId, mutate],
  );

  const disableVariableEditing = useMemo(() => {
    return !isTemplate && !isLocal;
  }, [isTemplate, isLocal]);

  return (
    <VStack fullHeight>
      <VStack>
        <Alert
          variant="info"
          title={
            isLocal
              ? t('ToolVariables.details.local')
              : t.rich('ToolVariables.details.cloud', {
                  link: (chunks) => (
                    <Link
                      target="_blank"
                      href="/settings/organization/environment-variables"
                    >
                      {chunks}
                    </Link>
                  ),
                })
          }
        />
      </VStack>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          <VStack fullHeight>
            <FormField
              render={({ field }) => {
                return (
                  <>
                    {disableVariableEditing && field.value.length === 0 && (
                      <Alert
                        variant="info"
                        title={t('ToolVariables.noVariables')}
                      />
                    )}
                    <KeyValueEditor
                      addVariableLabel={t('ToolVariables.addVariable')}
                      fullWidth
                      freezeRows={disableVariableEditing}
                      hideLabel
                      label={t('ToolVariables.label')}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </>
                );
              }}
              name="variables"
            />
          </VStack>
          {(!disableVariableEditing ||
            (tool_exec_environment_variables || []).length > 0) && (
            <FormActions>
              <Button
                onClick={() => {
                  setModalState(false);
                }}
                color="secondary"
                label={t('close')}
              />
              <Button
                busy={isPending}
                type="submit"
                data-testid="save-variables-button"
                color="primary"
                label={t('ToolVariables.save')}
              />
            </FormActions>
          )}
        </Form>
      </FormProvider>
    </VStack>
  );
}

function MemoryVariableEditorWrapper() {
  const { agentSession } = useCurrentSimulatedAgent();
  const agentState = useCurrentAgent();

  const variableList = useMemo(() => {
    if (!getIsAgentState(agentState)) {
      return [];
    }

    return findMemoryBlockVariables(agentState);
  }, [agentState]);

  if (!agentSession?.body) {
    return <LettaLoader variant="grower" />;
  }

  const mergedVariables = {
    ...Object.fromEntries(variableList.map((key) => [key, ''])),
    ...agentSession.body.memoryVariables,
  };

  return <MemoryVariableEditor variables={mergedVariables} />;
}

interface MemoryVariableEditorProps {
  variables: Record<string, string>;
}

function MemoryVariableEditor(props: MemoryVariableEditorProps) {
  const { variables } = props;
  const queryClient = useQueryClient();
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();
  const { tool_exec_environment_variables } = useCurrentAgent();
  const t = useTranslations('ADE/AgentVariablesModal');

  const memoryVariableFormState = z.object({
    variables: z.array(
      z.object({
        key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
          message: t('MemoryVariableEditor.keyError'),
        }),
        value: z.string(),
      }),
    ),
  });

  type MemoryVariableFormStateType = z.infer<typeof memoryVariableFormState>;

  const [_, setModalState] = useAtom(agentVariableModalState);

  const { mutate, isPending } =
    webApi.agentTemplates.createAgentTemplateSimulatorSession.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<GetAgentTemplateSimulatorSessionResponseBody>(
          {
            queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateSession({
              agentTemplateId,
            }),
          },
          () => {
            return {
              status: 200,
              body: response.body,
            };
          },
        );

        setModalState(false);
      },
    });

  const form = useForm<MemoryVariableFormStateType>({
    resolver: zodResolver(memoryVariableFormState),
    defaultValues: {
      variables: Object.entries(variables).map(([key, value]) => ({
        key,
        value,
      })),
    },
  });

  const handleUpdateSession = useCallback(
    (values: MemoryVariableFormStateType) => {
      const variableData = Object.fromEntries(
        values.variables.map(({ key, value }) => [key, value]),
      );

      mutate(
        {
          params: {
            agentTemplateId,
          },
          body: {
            memoryVariables: variableData,
            toolVariables: Object.fromEntries(
              (tool_exec_environment_variables || []).map(({ key, value }) => [
                key,
                value,
              ]),
            ),
          },
        },
        {
          onSuccess: () => {
            queryClient.setQueriesData<
              GetAgentTemplateSimulatorSessionResponseBody | undefined
            >(
              {
                queryKey:
                  webApiQueryKeys.agentTemplates.getAgentTemplateSession({
                    agentTemplateId,
                  }),
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  status: 200,
                  body: {
                    ...oldData?.body,
                    memoryVariables: {
                      ...oldData?.body.memoryVariables,
                      ...variableData,
                    },
                  },
                };
              },
            );
          },
        },
      );
    },
    [agentTemplateId, mutate, queryClient, tool_exec_environment_variables],
  );

  return (
    <VStack fullHeight>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleUpdateSession)}>
          <VStack fullHeight>
            <FormField
              render={({ field }) => {
                return (
                  <KeyValueEditor
                    addVariableLabel={t('MemoryVariableEditor.addVariable')}
                    fullWidth
                    hideLabel
                    value={field.value}
                    label={t('MemoryVariableEditor.label')}
                    onValueChange={field.onChange}
                  />
                );
              }}
              name="variables"
            />
          </VStack>
          <FormActions>
            <Button
              onClick={() => {
                setModalState(false);
              }}
              type="button"
              color="secondary"
              label={t('close')}
            />
            <Button
              busy={isPending}
              type="submit"
              data-testid="save-variables-button"
              color="primary"
              label={t('MemoryVariableEditor.save')}
            />
          </FormActions>
        </Form>
      </FormProvider>
    </VStack>
  );
}

function MemoriesVariables() {
  const t = useTranslations('ADE/AgentVariablesModal');

  const { isLocal, isTemplate, isFromTemplate } = useCurrentAgentMetaData();

  if (isLocal) {
    return (
      <VStack>
        <Alert
          variant="warning"
          title={t('MemoryVariableEditor.notSupported')}
        />
      </VStack>
    );
  }

  if (!isTemplate) {
    if (!isFromTemplate) {
      return (
        <Alert
          title={t('noVariablesInDeployedAgentWithNoTemplate')}
          variant="info"
        />
      );
    }
  }

  return (
    <VStack fullHeight>
      <Alert
        variant="info"
        title={t.rich('MemoryVariableEditor.details', {
          syntax: () => '{{variableName}}',
        })}
      />
      {isTemplate ? (
        <MemoryVariableEditorWrapper />
      ) : (
        <DeployedAgentVariables />
      )}
    </VStack>
  );
}

function AgentVariablesContent() {
  const t = useTranslations('ADE/AgentVariablesModal');

  const { isLocal } = useCurrentAgentMetaData();

  const [displayMode, setDisplayMode] = React.useState<VariableDisplayMode>(
    isLocal ? 'environment' : 'memories',
  );

  const items = useMemo(() => {
    const preItems = [
      {
        label: t('AgentVariablesContent.tabs.memories'),
        value: 'memories',
      },
      {
        label: t('AgentVariablesContent.tabs.environment'),
        value: 'environment',
      },
    ];

    if (isLocal) {
      return preItems.toReversed();
    }

    return preItems;
  }, [isLocal, t]);

  return (
    <VStack fullHeight>
      <TabGroup
        onValueChange={(value) => {
          setDisplayMode(value as VariableDisplayMode);
        }}
        items={items}
      />
      {displayMode === 'memories' && <MemoriesVariables />}
      {displayMode === 'environment' && <ToolVariables />}
    </VStack>
  );
}

interface AgentVariablesModalProps {
  trigger: React.ReactNode;
}

const agentVariableModalState = atom<boolean>(false);

export function AgentVariablesModal(props: AgentVariablesModalProps) {
  const { trigger } = props;
  const t = useTranslations('ADE/AgentVariablesModal');
  useAgentVariables();

  const [isOpen, setIsOpen] = useAtom(agentVariableModalState);

  const { isTemplate } = useCurrentAgentMetaData();
  const title = useMemo(() => {
    if (isTemplate) {
      return t('title.simulated');
    }

    return t('title.default');
  }, [t, isTemplate]);

  return (
    <Dialog
      hideFooter
      maintainAspectRatio
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen);
      }}
      disableForm
      color="background"
      size="large"
      trigger={trigger}
      title={title}
    >
      <VStack fullHeight paddingBottom>
        <AgentVariablesContent />
      </VStack>
    </Dialog>
  );
}
