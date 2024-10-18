'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type {
  FileTreeContentsType,
  PanelTemplate,
} from '@letta-web/component-library';
import {
  brandKeyToLogo,
  brandKeyToName,
  Card,
  CheckIcon,
  InlineCode,
  isBrandKey,
  NiceGridDisplay,
  SearchIcon,
} from '@letta-web/component-library';
import { getIsGenericFolder } from '@letta-web/component-library';
import { toast } from '@letta-web/component-library';
import {
  Dialog,
  FileTree,
  Logo,
  PlusIcon,
  ToolsIcon,
  Typography,
} from '@letta-web/component-library';
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
  useForm,
  VStack,
  LettaLoaderPanel,
  HStack,
} from '@letta-web/component-library';
import { useCurrentAgent } from '../hooks';
import type { AgentState, Tool_Output } from '@letta-web/letta-agents-api';
import { useAgentsServiceAddToolToAgent } from '@letta-web/letta-agents-api';
import { useAgentsServiceRemoveToolFromAgent } from '@letta-web/letta-agents-api';
import {
  useToolsServiceCreateTool,
  useToolsServiceGetTool,
  UseToolsServiceGetToolKeyFn,
  useToolsServiceUpdateTool,
} from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentKeyFn,
  useToolsServiceListTools,
  UseToolsServiceListToolsKeyFn,
} from '@letta-web/letta-agents-api';

import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useTranslations } from 'next-intl';
import { Slot } from '@radix-ui/react-slot';

const { usePanelRouteData, usePanelPageContext } = createPageRouter(
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

interface AddToolDialogDetailActionsProps {
  tool: AddToolsListItem;
}

function AddToolDialogDetailActions(props: AddToolDialogDetailActionsProps) {
  const { tool } = props;
  const t = useTranslations('ADE/Tools');
  const queryClient = useQueryClient();
  const { id: agentId } = useCurrentAgent();

  const { mutate: addTool, isPending: isAddingTool } =
    useAgentsServiceAddToolToAgent({
      onSuccess: (nextAgentState) => {
        queryClient.setQueriesData<AgentState | undefined>(
          {
            queryKey: UseAgentsServiceGetAgentKeyFn({
              agentId: agentId,
            }),
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              tools: nextAgentState.tools,
            };
          }
        );
      },
      onError: () => {
        toast.error(t('AddToolDialogDetailActions.addError'));
      },
    });

  const handleAdd = useCallback(() => {
    addTool({
      agentId,
      toolId: tool.id || '',
    });
  }, [addTool, agentId, tool.id]);

  return (
    <>
      {tool.alreadyAdded ? (
        <Button
          type="button"
          label={t('AddToolDialogDetailActions.alreadyAdded')}
          disabled
          color="tertiary"
          fullWidth
          preIcon={<CheckIcon />}
        />
      ) : (
        <Button
          type="button"
          preIcon={<PlusIcon />}
          label={t('AddToolDialogDetailActions.addToAgent')}
          color="tertiary"
          fullWidth
          busy={isAddingTool}
          onClick={handleAdd}
        />
      )}
    </>
  );
}

interface AddToolDialogProps {
  onClose: () => void;
}

interface AddToolsListItem {
  name: string;
  description: string;
  id: string;
  alreadyAdded: boolean;
  creator: string;
  icon: React.ReactNode;
}

function AddToolDialog(props: AddToolDialogProps) {
  const { onClose } = props;
  const t = useTranslations('ADE/Tools');
  const { data: allTools } = useToolsServiceListTools();
  const { tools } = useCurrentAgent();

  const addedToolNameSet = useMemo(() => {
    return new Set(tools);
  }, [tools]);

  const [search, setSearch] = useState('');

  const toolsList: AddToolsListItem[] = useMemo(() => {
    return (allTools || [])
      .filter(
        (tool) =>
          !tool.tags.includes('letta-base') &&
          !tool.tags.includes('memgpt-base')
      )
      .map((tool) => {
        const creator = tool.tags.find((tag) => isBrandKey(tag)) || '';

        return {
          name: tool.name || '',
          id: tool.id || '',
          creator: brandKeyToName(creator || 'letta'),
          description: tool.description || '',
          alreadyAdded: addedToolNameSet.has(tool.name),
          icon: isBrandKey(creator) ? brandKeyToLogo(creator) : <ToolsIcon />,
        };
      })
      .filter((tool) => tool.name.toLowerCase().includes(search.toLowerCase()));
  }, [allTools, addedToolNameSet, search]);

  return (
    <Dialog
      isOpen
      color="background"
      hideConfirm
      title={t('AddToolDialog.title')}
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      size="full"
    >
      <HStack fullHeight>
        <VStack fullHeight fullWidth>
          <RawInput
            preIcon={<SearchIcon />}
            hideLabel
            placeholder={t('AddToolDialog.search.placeholder')}
            label={t('AddToolDialog.search.label')}
            fullWidth
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
          <VStack fullHeight fullWidth overflowY="auto">
            <NiceGridDisplay>
              {toolsList.map((tool) => (
                <Card
                  key={tool.id}
                  /* eslint-disable-next-line react/forbid-component-props */
                  className="h-[300px] max-h-[300px]"
                >
                  <VStack fullHeight overflow="hidden">
                    <HStack align="center" justify="spaceBetween">
                      <VStack justify="start" gap="small">
                        <HStack>
                          {/* eslint-disable-next-line react/forbid-component-props */}
                          <Slot className="w-5 h-5">{tool.icon}</Slot>

                          <InlineCode hideCopyButton code={`${tool.name}()`} />
                        </HStack>
                        <Typography align="left" variant="body2">
                          {t('AddToolDialog.creator', {
                            creator: tool.creator,
                          })}
                        </Typography>
                      </VStack>
                    </HStack>
                    <VStack overflowY="auto" collapseHeight>
                      <Typography variant="body">{tool.description}</Typography>
                    </VStack>
                    <AddToolDialogDetailActions tool={tool} />
                  </VStack>
                </Card>
              ))}
            </NiceGridDisplay>
          </VStack>
        </VStack>
      </HStack>
    </Dialog>
  );
}

interface RemoveToolPayload {
  toolName: string;
  toolId: string;
}

interface RemoveToolFromAgentDialogProps extends RemoveToolPayload {
  onClose: () => void;
}

function RemoveToolDialog(props: RemoveToolFromAgentDialogProps) {
  const { toolId, toolName, onClose } = props;
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/Tools');
  const queryClient = useQueryClient();

  const {
    mutate,
    isError,
    isPending: isUpdatingTools,
  } = useAgentsServiceRemoveToolFromAgent({
    onSuccess: (nextAgentState) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceGetAgentKeyFn({
            agentId: agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tools: nextAgentState.tools,
          };
        }
      );

      onClose();
    },
  });

  const handleRemove = useCallback(() => {
    mutate({
      agentId,
      toolId,
    });
  }, [agentId, toolId, mutate]);

  return (
    <Dialog
      isOpen
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      errorMessage={isError ? t('RemoveToolDialog.error') : undefined}
      title={t('RemoveToolDialog.title', { toolName })}
      confirmText={t('RemoveToolDialog.confirm')}
      onConfirm={handleRemove}
      isConfirmBusy={isUpdatingTools}
    >
      {t('RemoveToolDialog.confirmation')}
    </Dialog>
  );
}

interface ToolsProps {
  search: string;
}

function ToolsList(props: ToolsProps) {
  const { search } = props;
  const { tools: currentToolNames } = useCurrentAgent();
  const { data: allTools, isLoading } = useToolsServiceListTools();

  const t = useTranslations('ADE/Tools');

  const [removeToolPayload, setRemoveToolPayload] =
    useState<RemoveToolPayload | null>(null);

  const currentToolsAsSet = useMemo(() => {
    return new Set(currentToolNames);
  }, [currentToolNames]);

  const currentUserTools = useMemo(() => {
    return allTools?.filter((tool) => currentToolsAsSet.has(tool.name));
  }, [allTools, currentToolsAsSet]);

  const [isAddToolDialogOpen, setIsAddToolDialogOpen] = useState(false);

  const toolsList: FileTreeContentsType = useMemo(() => {
    if (!currentUserTools) {
      return [];
    }

    let lettaCoreToolCount = 0;
    let otherToolCount = 0;

    const fileTreeTools: FileTreeContentsType = [
      {
        name: '',
        id: 'core-tools',
        contents: [],
      },
      {
        id: 'other-tools',
        name: '',
        contents: [],
        defaultOpen: true,
      },
    ];

    currentUserTools.forEach((tool) => {
      if (!tool.name.toLowerCase().includes(search.toLowerCase())) {
        return;
      }

      if (
        tool.tags.includes('letta-base') ||
        tool.tags.includes('memgpt-base')
      ) {
        lettaCoreToolCount += 1;
        if (getIsGenericFolder(fileTreeTools[0])) {
          fileTreeTools[0].contents.push({
            name: tool.name,
            id: tool.id || '',
            icon: <Logo size="small" />,
          });
        }
      } else {
        otherToolCount += 1;
        if (getIsGenericFolder(fileTreeTools[1])) {
          const creator = tool.tags.find((tag) => isBrandKey(tag)) || '';

          fileTreeTools[1].contents.push({
            name: tool.name,
            id: tool.id,
            icon: isBrandKey(creator) ? brandKeyToLogo(creator) : <ToolsIcon />,
            actions: [
              {
                id: 'remove-tool',
                label: t('ToolsList.removeTool'),
                onClick: () => {
                  setRemoveToolPayload({
                    toolName: tool.name || '',
                    toolId: tool.id || '',
                  });
                },
              },
            ],
          });
        }
      }
    });

    fileTreeTools[0].name = t('ToolsList.lettaCoreTools', {
      toolCount: lettaCoreToolCount,
    });
    fileTreeTools[1].name = t('ToolsList.otherTools', {
      toolCount: otherToolCount,
    });

    if (getIsGenericFolder(fileTreeTools[1])) {
      fileTreeTools[1].contents.push({
        name: t('ToolsList.addNewTool'),
        id: 'new',
        icon: <PlusIcon />,
        onClick: () => {
          setIsAddToolDialogOpen(true);
        },
      });
    }

    return fileTreeTools;
  }, [currentUserTools, search, t]);

  return (
    <PanelMainContent>
      {isAddToolDialogOpen && (
        <AddToolDialog
          onClose={() => {
            setIsAddToolDialogOpen(false);
          }}
        />
      )}
      {removeToolPayload && (
        <RemoveToolDialog
          toolId={removeToolPayload.toolId}
          toolName={removeToolPayload.toolName}
          onClose={() => {
            setRemoveToolPayload(null);
          }}
        />
      )}
      {isLoading && <LettaLoaderPanel />}
      <FileTree root={toolsList} />
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
              color="primary"
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
                  color="primary"
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

export function EditToolPage() {
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
      <ToolsList search={search} />
    </>
  );
}

export const toolsPanelTemplate = {
  templateId: 'tools-panel',
  content: ToolsListPage,
  useGetTitle: () => {
    const t = useTranslations('ADE/Tools');
    const { tools } = useCurrentAgent();

    return t('title', {
      toolCount: tools?.length || '-',
    });
  },
  data: z.undefined(),
} satisfies PanelTemplate<'tools-panel'>;
