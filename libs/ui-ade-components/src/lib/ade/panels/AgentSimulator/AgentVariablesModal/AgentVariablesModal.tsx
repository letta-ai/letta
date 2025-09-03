import {
  Alert,
  Button,
  DynamicApp,
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
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent, useCurrentAgentMetaData, useUpdateSimulatedMemoryBlocksOnVariableInjection } from '../../../../hooks';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { Link } from '@letta-cloud/ui-component-library';
import {
  UseAgentsServiceRetrieveAgentKeyFn,
  useAgentsServiceModifyAgent,
} from '@letta-cloud/sdk-core';
import type { AgentState } from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { atom, useAtom } from 'jotai';
import {
  webApi,
  type webApiContracts,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import {
  convertMemoryVariablesV1ToRecordMemoryVariables,
  removeMetadataFromBlockTemplate,
  synchronizeSimulatedAgentWithAgentTemplate
} from '@letta-cloud/utils-shared';
import {
  useCurrentSimulatedAgent,
  useCurrentSimulatedAgentVariables,
} from '../../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import type { ServerInferResponses } from '@ts-rest/core';

function useAgentVariables() {
  const { isFromTemplate } = useCurrentAgentMetaData();
  const { id: agentId } = useCurrentAgent();
  return cloudAPI.agents.getAgentVariables.useQuery({
    queryKey: cloudQueryKeys.agents.getAgentVariables(agentId),
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
        <Skeleton className="w-full h-[30px]" />
        <Skeleton className="w-full h-[30px]" />
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
  const variables = useCurrentSimulatedAgentVariables();
  const {
    isTemplate,
    templateId: agentTemplateId,
  } = useCurrentAgentMetaData();

  const { simulatedAgent } = useCurrentSimulatedAgent();

  const { data: blockTemplates } =
    webApi.blockTemplates.getAgentTemplateBlockTemplates.useQuery({
      queryData: {
        params: { agentTemplateId: agentTemplateId || '' },
      },
      queryKey: webApiQueryKeys.blockTemplates.getAgentTemplateBlockTemplates(
        agentTemplateId || '',
      ),
      enabled: !!(isTemplate && agentTemplateId),
    });


  const agentTemplateVariables = useMemo(() => {
    if (!isTemplate || !simulatedAgent || !blockTemplates) {
      return {};
    }

    const cleanedBlockTemplates = blockTemplates.body.blockTemplates.map(removeMetadataFromBlockTemplate);

    // Synchronize current agent state to get comparable data structure
    const { agentTemplate } =
      synchronizeSimulatedAgentWithAgentTemplate({
        ...simulatedAgent,
        memory: {
          ...simulatedAgent,
          blocks: cleanedBlockTemplates,
        }
      });

    if (!agentTemplate.memoryVariables) {
      return {};
    }

    return convertMemoryVariablesV1ToRecordMemoryVariables(
      agentTemplate.memoryVariables
    );
  }, [simulatedAgent, isTemplate, blockTemplates]);

  if (!variables) {
    return <LettaLoader variant="grower" />;
  }

  const mergedVariables = {
    ...agentTemplateVariables,
    ...variables.memoryVariables,
  };

  return <MemoryVariableEditor variables={mergedVariables} />;
}

interface MemoryVariableEditorProps {
  variables: Record<string, string>;
}

function MemoryVariableEditor(props: MemoryVariableEditorProps) {
  const { variables } = props;
  const queryClient = useQueryClient();
  const { simulatedAgentId } = useCurrentSimulatedAgent();
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


  const refreshMemoryBlocks = useUpdateSimulatedMemoryBlocksOnVariableInjection();
  const { mutate: resync } =
    webApi.simulatedAgents.refreshSimulatedSession.useMutation({
      mutationKey: webApiQueryKeys.simulatedAgents.refreshSimulatedSession(simulatedAgentId || ''),
    });

  const { mutate, isPending } =
    webApi.simulatedAgents.updateSimulatedAgentVariables.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof webApiContracts.simulatedAgents.getSimulatedAgentVariables,
            200
          >
        >(
          {
            queryKey:
              webApiQueryKeys.simulatedAgents.getSimulatedAgentVariables(
                simulatedAgentId || '',
              ),
          },
          () => {
            return {
              status: 200,
              body: response.body,
            };
          },
        );

        resync({
          params: {
            simulatedAgentId: simulatedAgentId || '',
          },
        });

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

      refreshMemoryBlocks(variableData);

      mutate({
        params: {
          simulatedAgentId: simulatedAgentId || '',
        },
        body: {
          memoryVariables: variableData,
        },
      });
    },
    [refreshMemoryBlocks, simulatedAgentId, mutate],
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
        value={displayMode}
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
    <DynamicApp
      defaultView="windowed"
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      windowConfiguration={{
        minWidth: 480,
        minHeight: 400,
        defaultWidth: 480,
        defaultHeight: 480,
      }}
      trigger={trigger}
      name={title}
    >
      <VStack color="background" overflowY="auto" padding="small" fullHeight>
        <AgentVariablesContent />
      </VStack>
    </DynamicApp>
  );
}
