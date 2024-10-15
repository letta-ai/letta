'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  Button,
  CodeEditor,
  createPageRouter,
  Form,
  FormField,
  FormProvider,
  Input,
  PanelBar,
  PanelMainContent,
  RawInput,
  ActionCard,
  useForm,
  VStack,
  RawSwitch,
  LettaLoaderPanel,
  HStack,
} from '@letta-web/component-library';
import { useCurrentAgent } from '../hooks';
import type { AgentState, Tool_Output } from '@letta-web/letta-agents-api';
import {
  useToolsServiceCreateTool,
  useToolsServiceGetTool,
  UseToolsServiceGetToolKeyFn,
  useToolsServiceUpdateTool,
} from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentKeyFn,
  useAgentsServiceUpdateAgent,
  useToolsServiceListTools,
  UseToolsServiceListToolsKeyFn,
} from '@letta-web/letta-agents-api';

import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';

const { PanelRouter, usePanelRouteData, usePanelPageContext } =
  createPageRouter(
    {
      editTool: {
        title: ({ toolId }) => (toolId ? 'Edit Tool' : 'Create Tool'),
        state: z.object({
          toolId: z.string(),
          toolName: z.string(),
        }),
      },
      root: {
        title: 'Tools',
        state: z.object({}),
      },
    },
    {
      initialPage: 'root',
    }
  );

function ToolsList() {
  const { id: currentAgentId, tools: currentToolNames } = useCurrentAgent();
  const { data: allTools, isLoading } = useToolsServiceListTools();
  const { setCurrentPage } = usePanelPageContext();

  const { mutate } = useAgentsServiceUpdateAgent({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: UseAgentsServiceGetAgentKeyFn({
          agentId: currentAgentId,
        }),
      });

      const previousAgentState = queryClient.getQueryData<
        AgentState | undefined
      >(
        UseAgentsServiceGetAgentKeyFn({
          agentId: currentAgentId,
        })
      );

      queryClient.setQueryData<AgentState | undefined>(
        UseAgentsServiceGetAgentKeyFn({
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
          UseAgentsServiceGetAgentKeyFn({
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
    <PanelMainContent>
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
    </PanelMainContent>
  );
}

const createToolSchema = z.object({
  name: z.string(),
  sourceCode: z.string(),
});

function ToolCreator() {
  const queryClient = useQueryClient();

  const { mutate, isPending: isCreatingTool } = useToolsServiceCreateTool({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: UseToolsServiceListToolsKeyFn(),
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
        <PanelMainContent>
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
        </PanelMainContent>
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
  const { setCurrentPage } = usePanelPageContext();

  const { mutate, isPending: isUpdatingTool } = useToolsServiceUpdateTool({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: UseToolsServiceGetToolKeyFn({
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
        <PanelMainContent>
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
                  type="button"
                  label="Cancel"
                  color="tertiary"
                  onClick={() => {
                    setCurrentPage('root', {});
                  }}
                />
                <Button
                  type="submit"
                  label="Save"
                  color="secondary"
                  busy={isUpdatingTool}
                />
              </HStack>
            </>
          )}
        </PanelMainContent>
      </Form>
    </FormProvider>
  );
}

function EditToolPage() {
  const { toolId } = usePanelRouteData<'editTool'>();
  const { data, isLoading } = useToolsServiceGetTool(
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

  return (
    <>
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
  const { isLocal } = useCurrentAgentMetaData();

  return (
    <>
      <PanelBar
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        actions={
          isLocal && (
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
          )
        }
      />
      <ToolsList />
    </>
  );
}

export function ToolsPanel() {
  return (
    <PanelRouter
      rootPageKey="root"
      pages={{
        editTool: <EditToolPage />,
        root: <ToolsListPage />,
      }}
    />
  );
}

export const toolsPanelTemplate = {
  templateId: 'tools-panel',
  content: ToolsPanel,
  useGetTitle: () => 'Tools',
  data: z.undefined(),
} satisfies PanelTemplate<'tools-panel'>;
