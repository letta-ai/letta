'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  CodeEditor,
  createPageRouter,
  Form,
  FormField,
  FormProvider,
  Input,
  Panel,
  PanelBar,
  PanelLastElement,
  PanelHeader,
  RawInput,
  ActionCard,
  useForm,
  VStack,
  RawSwitch,
  LettaLoaderPanel,
  HStack,
} from '@letta-web/component-library';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import { useCurrentAgent, useCurrentAgentId } from '../hooks';
import type { AgentState, Tool_Output } from '@letta-web/letta-agents-api';
import {
  useToolsServiceCreateToolApiToolsPost,
  useToolsServiceGetToolApiToolsToolIdGet,
  UseToolsServiceGetToolApiToolsToolIdGetKeyFn,
  UseToolsServiceListAllToolsApiToolsGetKeyFn,
  useToolsServiceUpdateToolApiToolsToolIdPost,
} from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn,
  useAgentsServiceUpdateAgentApiAgentsAgentIdPost,
  useToolsServiceListAllToolsApiToolsGet,
} from '@letta-web/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const { PanelRouter, usePanelRouteData, usePanelPageContext } =
  createPageRouter(
    {
      editTool: {
        state: z.object({
          toolId: z.string(),
          toolName: z.string(),
        }),
      },
      root: {
        state: z.object({}),
      },
    },
    {
      initialPage: 'root',
    }
  );

function ToolsList() {
  const currentAgentId = useCurrentAgentId();
  const { tools: currentToolNames } = useCurrentAgent();
  const { data: allTools, isLoading } =
    useToolsServiceListAllToolsApiToolsGet();
  const { setCurrentPage } = usePanelPageContext();

  const { mutate } = useAgentsServiceUpdateAgentApiAgentsAgentIdPost({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
          agentId: currentAgentId,
        }),
      });

      const previousAgentState = queryClient.getQueryData<
        AgentState | undefined
      >(
        UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
          agentId: currentAgentId,
        })
      );

      queryClient.setQueryData<AgentState | undefined>(
        UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
          agentId: currentAgentId,
        }),
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tools: variables.requestBody.tools || [],
          };
        }
      );

      return { previousAgentState };
    },
    onError: (_aw, _b, context) => {
      if (context?.previousAgentState) {
        queryClient.setQueryData(
          UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
            agentId: currentAgentId,
          }),
          context.previousAgentState
        );
      }
    },
  });
  const queryClient = useQueryClient();

  const handleToggleCardChange = useCallback(
    (toolName: string, checked: boolean) => {
      const newTools = checked
        ? [...currentToolNames, toolName]
        : currentToolNames.filter((name) => name !== toolName);

      mutate({
        agentId: currentAgentId,
        requestBody: {
          id: currentAgentId,
          tools: newTools,
        },
      });
    },
    [currentAgentId, currentToolNames, mutate]
  );

  const currentToolsAsSet = useMemo(() => {
    return new Set(currentToolNames);
  }, [currentToolNames]);

  return (
    <PanelLastElement>
      <VStack fullWidth gap="small">
        {isLoading && <LettaLoaderPanel />}
        {(allTools || []).map((tool) => {
          return (
            <ActionCard
              key={tool.id}
              title={tool.name}
              description={tool.description || ''}
              mainAction={
                <RawSwitch
                  hideLabel
                  label={
                    currentToolsAsSet.has(tool.name)
                      ? `Enable ${tool.name}`
                      : `Disable ${tool.name}`
                  }
                  checked={currentToolsAsSet.has(tool.name)}
                  onChange={() => {
                    handleToggleCardChange(
                      tool.name,
                      !currentToolsAsSet.has(tool.name)
                    );
                  }}
                />
              }
              actions={
                <Button
                  onClick={() => {
                    setCurrentPage('editTool', {
                      toolId: tool.id,
                      toolName: tool.name,
                    });
                  }}
                  label="Configure"
                  size="small"
                  color="tertiary"
                />
              }
            />
          );
        })}
      </VStack>
    </PanelLastElement>
  );
}

const createToolSchema = z.object({
  name: z.string(),
  sourceCode: z.string(),
});

function ToolCreator() {
  const queryClient = useQueryClient();

  const { mutate, isPending: isCreatingTool } =
    useToolsServiceCreateToolApiToolsPost({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: UseToolsServiceListAllToolsApiToolsGetKeyFn(),
        });
      },
    });

  const form = useForm<z.infer<typeof createToolSchema>>({
    resolver: zodResolver(createToolSchema),
    defaultValues: {
      sourceCode: '',
    },
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createToolSchema>) => {
      mutate({
        requestBody: {
          tags: [],
          name: values.name,
          source_code: values.sourceCode,
        },
      });
    },
    [mutate]
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <PanelLastElement>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => <Input fullWidth label="Name" {...field} />}
          />
          <FormField
            control={form.control}
            name="sourceCode"
            render={({ field }) => (
              <CodeEditor
                fullWidth
                toolbarPosition="bottom"
                language="python"
                code={field.value}
                onSetCode={field.onChange}
                label="Source Code"
              />
            )}
          />
          <HStack fullWidth justify="end">
            <Button
              type="submit"
              label="Create"
              color="secondary"
              busy={isCreatingTool}
            />
          </HStack>
        </PanelLastElement>
      </Form>
    </FormProvider>
  );
}

const editToolSchema = z.object({
  sourceCode: z.string(),
  description: z.string(),
});

interface ToolEditorProps {
  initialTool?: Tool_Output;
  isLoading: boolean;
}

function ToolEditor(props: ToolEditorProps) {
  const { initialTool, isLoading } = props;
  const queryClient = useQueryClient();

  const { mutate, isPending: isUpdatingTool } =
    useToolsServiceUpdateToolApiToolsToolIdPost({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: UseToolsServiceGetToolApiToolsToolIdGetKeyFn({
            toolId: initialTool?.id || '',
          }),
        });
      },
    });

  const form = useForm<z.infer<typeof editToolSchema>>({
    resolver: zodResolver(editToolSchema),
    defaultValues: {
      sourceCode: initialTool?.source_code || '',
      description: initialTool?.description || '',
    },
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof editToolSchema>) => {
      mutate({
        toolId: initialTool?.id || '',
        requestBody: {
          id: initialTool?.id || '',
          description: values.description,
          source_code: values.sourceCode,
        },
      });
    },
    [initialTool?.id, mutate]
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <PanelLastElement>
          {isLoading ? (
            <LettaLoaderPanel />
          ) : (
            <>
              <RawInput
                value={initialTool?.name}
                fullWidth
                disabled
                label="Name"
              />
              <FormField
                control={form.control}
                name="sourceCode"
                render={({ field }) => (
                  <CodeEditor
                    fullWidth
                    toolbarPosition="bottom"
                    language="python"
                    code={field.value}
                    onSetCode={field.onChange}
                    label="Source Code"
                  />
                )}
              />
              <HStack fullWidth justify="end">
                <Button
                  type="submit"
                  label="Save"
                  color="secondary"
                  busy={isUpdatingTool}
                />
              </HStack>
            </>
          )}
        </PanelLastElement>
      </Form>
    </FormProvider>
  );
}

function EditToolPage() {
  const { setCurrentPage } = usePanelPageContext();

  const { toolId, toolName } = usePanelRouteData<'editTool'>();
  const { data, isLoading } = useToolsServiceGetToolApiToolsToolIdGet(
    {
      toolId,
    },
    undefined,
    {
      enabled: !!toolId,
    }
  );

  const isNewTool = useMemo(() => {
    return !toolId;
  }, [toolId]);

  const pageName = useMemo(() => {
    return isNewTool ? 'Create Tool' : toolName;
  }, [toolName, isNewTool]);

  return (
    <>
      <PanelHeader
        onGoBack={() => {
          setCurrentPage('root');
        }}
        title={['Tools', pageName]}
      />
      {isNewTool ? (
        <ToolCreator />
      ) : (
        <ToolEditor
          initialTool={data}
          key={data?.source_code}
          isLoading={isLoading}
        />
      )}
    </>
  );
}

function ToolsListPage() {
  const { setCurrentPage } = usePanelPageContext();
  const [search, setSearch] = useState('');

  return (
    <>
      <PanelHeader title="Tools" />
      <PanelBar
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setCurrentPage('editTool', { toolId: '', toolName: '' });
              }}
              size="small"
              color="secondary"
              label="Create Tool"
            />
          </>
        }
      />
      <ToolsList />
    </>
  );
}

export function ToolsPanel() {
  return (
    <Panel
      width="compact"
      id={['sidebar', 'tools']}
      trigger={<ADENavigationItem title="Tools" />}
    >
      <PanelRouter
        pages={{
          editTool: <EditToolPage />,
          root: <ToolsListPage />,
        }}
      />
    </Panel>
  );
}
