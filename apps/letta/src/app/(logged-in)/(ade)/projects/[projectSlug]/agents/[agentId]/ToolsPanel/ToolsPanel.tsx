'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionCard, ChevronLeftIcon, ChevronRightIcon, CodeIcon, DialogContentWithCategories,
  FileTreeContentsType, Frame, ListIcon, LoadedTypography,
  PanelTemplate, RawCodeEditor, RawToggleGroup, ToggleGroup
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
import type {
  AgentState,
  letta__schemas__tool__Tool,
} from '@letta-web/letta-agents-api';
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

interface AllToolsViewProps {
  setSelectedToolId: (toolId: string) => void;
}

function AllToolsView(props: AllToolsViewProps) {
  const { setSelectedToolId } = props;

  const t = useTranslations('ADE/Tools');

  const { data: _allTools } = useToolsServiceListTools();

  const allTools = useMemo(() => {
    // deuplicate tools on name
    const tools = _allTools || [];

    const toolsMap = new Map<string, letta__schemas__tool__Tool>();

    tools.forEach((tool) => {
      toolsMap.set(tool.name || '', tool);
    });

    return Array.from(toolsMap.values());
  }, [_allTools]);

  const { tools } = useCurrentAgent();

  const addedToolNameSet = useMemo(() => {
    return new Set(tools);
  }, [tools]);

  const [search, setSearch] = useState('');

  const toolsList: AddToolsListItem[] = useMemo(() => {
    return (allTools || [])
      .filter(
        (tool) =>
          !tool.tags?.includes('letta-base') &&
          !tool.tags?.includes('memgpt-base')
      )
      .map((tool) => {
        const creator = tool.tags?.find((tag) => isBrandKey(tag)) || '';

        return {
          name: tool.name || '',
          id: tool.id || '',
          creator: brandKeyToName(creator || 'letta'),
          description: tool.description || '',
          alreadyAdded: addedToolNameSet.has(tool.name || ''),
          icon: isBrandKey(creator) ? brandKeyToLogo(creator) : <ToolsIcon />,
        };
      })
      .filter((tool) => tool.name.toLowerCase().includes(search.toLowerCase()));
  }, [allTools, addedToolNameSet, search]);

  return (
    <DialogContentWithCategories categories={[{
      id: 'all-tools',
      icon: <ToolsIcon />,
      title: t('AddToolDialog.categories.allTools'),
      children: (
        <HStack padding fullHeight>
          <VStack gap="large" fullHeight fullWidth>
            <HStack justify="spaceBetween">
              <RawInput
                preIcon={<SearchIcon />}
                hideLabel
                placeholder={t('AddToolDialog.search.placeholder')}
                label={t('AddToolDialog.search.label')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
              />
              <Button
                preIcon={<PlusIcon />}
                label={t('AddToolDialog.createTool')} color="secondary" />
            </HStack>
            <VStack fullHeight fullWidth overflowY="auto">
              <NiceGridDisplay>
                {toolsList.map((tool) => (
                  <ActionCard
                    noMobileViewChange
                    icon={tool.icon}
                    title={tool.name}
                    onClick={() => {
                      setSelectedToolId(tool.id);
                    }}
                    subtitle={t('AddToolDialog.creator', {
                      creator: tool.creator,
                    })}
                    key={tool.id}
                  >
                  </ActionCard>
                ))}
              </NiceGridDisplay>
            </VStack>
          </VStack>
        </HStack>
      )
    }]}
    />
  )
}

interface ViewToolToAddProps {
  toolId: string;
  onAddTool?: VoidFunction;
  onRemoveTool?: VoidFunction;
  onClose?: VoidFunction
}

type ViewMode = 'code' | 'schema';

function ViewTool(props: ViewToolToAddProps) {
  const { toolId, onAddTool, onClose } = props;
  const t = useTranslations('ADE/Tools');

  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const { data: tool } = useToolsServiceGetTool({
    toolId,
  });

  return (
    <VStack flex fullHeight="withMinHeight" paddingBottom>
      <VStack flex fullHeight="withMinHeight" flex color="background" border padding fullWidth>
        <VStack borderBottom paddingBottom>
          <div>
            {onClose && (
              <Button
                size="small"
                preIcon={<ChevronLeftIcon />}
                color="tertiary"
                label={t('ViewTool.back')}
                onClick={onClose}
              />
            )}
          </div>

          <HStack fullWidth>
            <HStack align="center">
              <LoadedTypography
                text={tool?.name}
                font="mono"
                variant="heading2"
                fillerText="SUPERLONGTOOLNAMESOCOOL"
              />
            </HStack>
          </HStack>
          <HStack fullWidth>
            <LoadedTypography
              fillerText="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor."
              text={tool?.description}
              variant="body"
            />
          </HStack>
        </VStack>
        <VStack flex fullHeight>
          <RawToggleGroup
            hideLabel
            border
            value={viewMode}
            onValueChange={mode => {
              if (mode) {
                setViewMode(mode as ViewMode);
              }
            }}
            label={t('ViewTool.viewToggle.label')} items={[{
            label: t('ViewTool.viewToggle.options.code'),
            value: 'code',
            icon: <CodeIcon />,
          }, {
            label: t('ViewTool.viewToggle.options.schema'),
            value: 'schema',
            icon: <ListIcon />,
          }]} />
          <VStack fullHeight flex>
            {viewMode === 'code' ? (
              <RawCodeEditor flex fullWidth fullHeight label="" language="python" code={tool?.source_code || ''} /> ) : (
              <div />
            )}
          </VStack>
        </VStack>
      </VStack>
    </VStack>
  );
}

interface AddToolsListItem {
  name: string;
  description: string;
  id: string;
  alreadyAdded: boolean;
  creator: string;
  icon: React.ReactNode;
}

function AddToolDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations('ADE/Tools');

  const [toolIdToView, setToolIdToView] = useState<string | null>(null);

  return (
    <Dialog
      isOpen
      hideFooter
      trigger={
        <Button
          label={t('AddToolDialog.trigger')}
          color="tertiary"
          hideLabel
          preIcon={<PlusIcon />}
        />
      }
      title={t('AddToolDialog.title')}
      onOpenChange={setOpen}
      size="full"
    >
      {toolIdToView ? (
        <ViewTool
          toolId={toolIdToView}
          onClose={() => {
            setToolIdToView(null);
          }}
        />
      ) : (
        <AllToolsView setSelectedToolId={setToolIdToView} />
      )}
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
  const { data: _allTools, isLoading } = useToolsServiceListTools();

  const allTools = useMemo(() => {
    // deuplicate tools on name
    const tools = _allTools || [];

    const toolsMap = new Map<string, letta__schemas__tool__Tool>();

    tools.forEach((tool) => {
      toolsMap.set(tool.name || '', tool);
    });

    return Array.from(toolsMap.values());
  }, [_allTools]);

  const t = useTranslations('ADE/Tools');

  const [removeToolPayload, setRemoveToolPayload] =
    useState<RemoveToolPayload | null>(null);

  const currentToolsAsSet = useMemo(() => {
    return new Set(currentToolNames);
  }, [currentToolNames]);

  const currentUserTools = useMemo(() => {
    return allTools?.filter((tool) => currentToolsAsSet.has(tool.name || ''));
  }, [allTools, currentToolsAsSet]);


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
      if (!tool.name?.toLowerCase().includes(search.toLowerCase())) {
        return;
      }

      if (
        tool.tags?.includes('letta-base') ||
        tool.tags?.includes('memgpt-base')
      ) {
        lettaCoreToolCount += 1;
        if (getIsGenericFolder(fileTreeTools[0])) {
          fileTreeTools[0].contents.push({
            name: tool.name || '',
            id: tool.id || '',
            icon: <Logo size="small" />,
          });
        }
      } else {
        otherToolCount += 1;
        if (getIsGenericFolder(fileTreeTools[1])) {
          const creator = tool.tags?.find((tag) => isBrandKey(tag)) || '';

          fileTreeTools[1].contents.push({
            name: tool.name || '',
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

    return fileTreeTools;
  }, [currentUserTools, search, t]);

  return (
    <PanelMainContent>
      {removeToolPayload && (
        <RemoveToolDialog
          toolId={removeToolPayload.toolId}
          toolName={removeToolPayload.toolName}
          onClose={() => {
            setRemoveToolPayload(null);
          }}
        />
      )}
      {isLoading ? <LettaLoaderPanel /> : <FileTree root={toolsList} />}
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
          source_type: 'python',
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
  initialTool?: letta__schemas__tool__Tool;
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
                value={initialTool?.name || ''}
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
  const [search, setSearch] = useState('');

  return (
    <>
      <PanelBar
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        actions={(
          <AddToolDialog />
        )}
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
