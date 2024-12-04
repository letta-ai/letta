'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type {
  FileTreeContentsType,
  PanelTemplate,
} from '@letta-web/component-library';
import {
  Alert,
  Code,
  Debugger,
  HiddenOnMobile,
  TerminalIcon,
} from '@letta-web/component-library';
import { Typography } from '@letta-web/component-library';
import {
  ActionCard,
  ChevronLeftIcon,
  CodeIcon,
  EditIcon,
  FormActions,
  LettaLoader,
  ListIcon,
  LoadedTypography,
  RawCodeEditor,
  RawToggleGroup,
} from '@letta-web/component-library';
import {
  brandKeyToLogo,
  brandKeyToName,
  isBrandKey,
  NiceGridDisplay,
  SearchIcon,
} from '@letta-web/component-library';
import { getIsGenericFolder } from '@letta-web/component-library';
import {
  Dialog,
  FileTree,
  Logo,
  PlusIcon,
  ToolsIcon,
} from '@letta-web/component-library';
import {
  Button,
  CodeEditor,
  Form,
  FormField,
  FormProvider,
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
  GetToolResponse,
  letta__schemas__tool__Tool,
} from '@letta-web/letta-agents-api';
import { useToolsServiceRunToolFromSource } from '@letta-web/letta-agents-api';
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
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { isAPIError } from '@letta-web/letta-agents-api';

interface AllToolsViewProps {
  setSelectedToolId: (toolId: string) => void;
  startCreateNewTool: VoidFunction;
}

function AllToolsView(props: AllToolsViewProps) {
  const { setSelectedToolId, startCreateNewTool } = props;

  const t = useTranslations('ADE/Tools');

  const { data: _allTools } = useToolsServiceListTools();

  const allTools = useMemo(() => {
    // deduplicate tools on name
    const tools = _allTools || [];

    const toolsMap = new Map<string, letta__schemas__tool__Tool>();

    tools.forEach((tool) => {
      toolsMap.set(tool.name || '', tool);
    });

    return Array.from(toolsMap.values());
  }, [_allTools]);

  const { tools } = useCurrentAgent();

  const toolIdSet = useMemo(() => {
    return new Set((tools || []).map((tool) => tool.id));
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
          creator: creator ? brandKeyToName(creator) : 'Custom',
          description: tool.description || '',
          alreadyAdded: toolIdSet.has(tool.id),
          icon: isBrandKey(creator) ? brandKeyToLogo(creator) : <ToolsIcon />,
        };
      })
      .filter((tool) => tool.name.toLowerCase().includes(search.toLowerCase()));
  }, [allTools, toolIdSet, search]);

  return (
    <HStack padding fullHeight>
      <VStack gap="large" fullHeight fullWidth>
        <HStack align="center" fullWidth justify="spaceBetween">
          <Typography variant="heading4" bold>
            All tools
          </Typography>
          <Button
            preIcon={<PlusIcon />}
            type="button"
            label={t('AddToolDialog.createTool')}
            color="secondary"
            onClick={() => {
              startCreateNewTool();
            }}
          />
        </HStack>
        <HStack fullWidth>
          <RawInput
            fullWidth
            preIcon={<SearchIcon />}
            hideLabel
            placeholder={t('AddToolDialog.search.placeholder')}
            label={t('AddToolDialog.search.label')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </HStack>
        <VStack fullHeight fullWidth overflowY="auto">
          <NiceGridDisplay>
            {toolsList.map((tool) => (
              <ActionCard
                hideClickArrow
                noMobileViewChange
                smallImage={
                  <HStack
                    align="center"
                    justify="center"
                    border
                    // eslint-disable-next-line react/forbid-component-props
                    className="w-10 h-10"
                  >
                    {tool.icon}
                  </HStack>
                }
                title={tool.name}
                onClick={() => {
                  setSelectedToolId(tool.id);
                }}
                subtitle={t('AddToolDialog.creator', {
                  creator: tool.creator,
                })}
                key={tool.id}
              ></ActionCard>
            ))}
          </NiceGridDisplay>
        </VStack>
      </VStack>
    </HStack>
  );
}

type ViewMode = 'code' | 'schema';

interface ViewToolProps {
  tool?: letta__schemas__tool__Tool;
}

function ViewTool(props: ViewToolProps) {
  const { tool } = props;

  const t = useTranslations('ADE/Tools');

  const [viewMode, setViewMode] = useState<ViewMode>('code');

  const toolDescription = useMemo(() => {
    if (!tool) {
      return undefined;
    }

    return tool.description || t('SpecificToolComponent.noDescription');
  }, [t, tool]);

  return (
    <VStack fullHeight flex>
      <VStack borderBottom paddingBottom fullWidth>
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
          <Typography fullWidth variant="body" italic={!tool?.description}>
            {toolDescription?.replace(/\n|\t/g, ' ').trim()}
          </Typography>
        </HStack>
      </VStack>
      <VStack flex collapseHeight>
        <RawToggleGroup
          hideLabel
          border
          value={viewMode}
          onValueChange={(mode) => {
            if (mode) {
              setViewMode(mode as ViewMode);
            }
          }}
          label={t('SpecificToolComponent.viewToggle.label')}
          items={[
            {
              label: t('SpecificToolComponent.viewToggle.options.code'),
              value: 'code',
              icon: <CodeIcon />,
            },
            {
              label: t('SpecificToolComponent.viewToggle.options.schema'),
              value: 'schema',
              icon: <ListIcon />,
            },
          ]}
        />
        <VStack collapseHeight flex>
          {viewMode === 'code' ? (
            <RawCodeEditor
              color="background-grey"
              toolbarPosition="bottom"
              flex
              fullWidth
              collapseHeight
              label=""
              language="python"
              code={tool?.source_code || ''}
            />
          ) : (
            <RawCodeEditor
              color="background-grey"
              toolbarPosition="bottom"
              flex
              fullWidth
              collapseHeight
              label=""
              language="javascript"
              code={
                tool?.json_schema
                  ? JSON.stringify(tool.json_schema, null, 2)
                  : ''
              }
            />
          )}
        </VStack>
      </VStack>
    </VStack>
  );
}

interface EditToolProps {
  tool: letta__schemas__tool__Tool;
  onClose: VoidFunction;
}

const editToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceCode: z.string(),
});

type EditToolFormValues = z.infer<typeof editToolSchema>;

function EditTool(props: EditToolProps) {
  const { tool, onClose } = props;

  const queryClient = useQueryClient();
  const form = useForm<EditToolFormValues>({
    resolver: zodResolver(editToolSchema),
    defaultValues: {
      name: tool.name || '',
      description: tool.description || '',
      sourceCode: tool.source_code || '',
    },
  });

  const { mutate, reset, isPending, isSuccess, error } =
    useToolsServiceUpdateTool();

  const t = useTranslations('ADE/Tools');

  const handleSubmit = useCallback(
    (values: EditToolFormValues) => {
      mutate(
        {
          toolId: tool.id || '',
          requestBody: {
            source_code: values.sourceCode,
          },
        },
        {
          onSuccess: () => {
            queryClient.setQueriesData<GetToolResponse | undefined>(
              {
                queryKey: UseToolsServiceGetToolKeyFn({
                  toolId: tool.id || '',
                }),
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  ...oldData,
                  description: values.description,
                  source_code: values.sourceCode,
                };
              }
            );

            onClose();
          },
        }
      );
    },
    [mutate, onClose, queryClient, tool.id]
  );

  const errorMessage = useMemo(() => {
    if (!error) {
      return '';
    }

    let message: unknown = '';

    if (isAxiosError(error)) {
      message = error.response?.data;
    }

    return JSON.stringify(message || error, null, 2);
  }, [error]);

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack collapseHeight flex gap="form">
          {errorMessage && (
            <ErrorMessageAlert message={errorMessage} onDismiss={reset} />
          )}
          <FormField
            name="sourceCode"
            render={({ field }) => (
              <ToolEditor code={field.value} onSetCode={field.onChange} />
            )}
          />
          <FormActions>
            <Button
              type="submit"
              label={t('EditTool.update')}
              color="secondary"
              busy={isPending || isSuccess}
            />
          </FormActions>
        </VStack>
      </Form>
    </FormProvider>
  );
}

interface SpecificToolComponentProps {
  toolId: string;
  onAddTool?: {
    operation: VoidFunction;
    isPending?: boolean;
    isError?: boolean;
    isSuccess?: boolean;
  };
  defaultIsEditingToolMode?: boolean;
  onRemoveTool?: VoidFunction;
  onClose?: VoidFunction;
}

function SpecificToolComponent(props: SpecificToolComponentProps) {
  const {
    toolId,
    onAddTool,
    onClose,
    defaultIsEditingToolMode = false,
  } = props;
  const { tools } = useCurrentAgent();

  const t = useTranslations('ADE/Tools');
  const [isEditingToolMode, setIsEditingToolMode] = useState(
    defaultIsEditingToolMode
  );

  const handleClose = useCallback(() => {
    setIsEditingToolMode(false);

    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const { data: tool } = useToolsServiceGetTool({
    toolId,
  });

  const isLettaTool = useMemo(() => {
    return (
      tool?.tags?.includes('letta-base') || tool?.tags?.includes('memgpt-base')
    );
  }, [tool]);

  const isToolAdded = useMemo(() => {
    if (!tools || !tool?.name) {
      return false;
    }

    return tools.some((someTool) => someTool.id === tool.id);
  }, [tools, tool]);

  const isToolsLoading = useMemo(() => {
    return !tool && !tools;
  }, [tool, tools]);

  return (
    <VStack flex fullHeight="withMinHeight" border padding fullWidth>
      <HStack fullWidth justify="spaceBetween">
        <HStack>
          {(onClose || isEditingToolMode) && (
            <Button
              size="small"
              preIcon={<ChevronLeftIcon />}
              color="tertiary"
              label={t('SpecificToolComponent.back')}
              onClick={() => {
                if (isEditingToolMode) {
                  setIsEditingToolMode(false);
                  return;
                }

                handleClose();
              }}
            />
          )}
        </HStack>
        <HStack>
          {!isEditingToolMode && !isLettaTool && (
            <Button
              size="small"
              type="button"
              busy={isToolsLoading}
              onClick={() => {
                setIsEditingToolMode(true);
              }}
              preIcon={<EditIcon />}
              color="tertiary"
              label={t('SpecificToolComponent.edit')}
            />
          )}
          {onAddTool && !isEditingToolMode && (
            <Button
              size="small"
              disabled={isToolAdded}
              type="button"
              busy={
                isToolsLoading || onAddTool.isPending || onAddTool.isSuccess
              }
              preIcon={<PlusIcon />}
              color="secondary"
              label={
                isToolAdded
                  ? t('SpecificToolComponent.alreadyAdded')
                  : t('SpecificToolComponent.add')
              }
              onClick={onAddTool.operation}
            />
          )}
        </HStack>
      </HStack>
      {isEditingToolMode ? (
        <>
          {!tool ? (
            <LettaLoader size="large" />
          ) : (
            <EditTool
              onClose={() => {
                setIsEditingToolMode(false);
              }}
              tool={tool}
            />
          )}
        </>
      ) : (
        <ViewTool tool={tool} />
      )}
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

  const { id: agentId } = useCurrentAgent();
  const [toolIdToView, setToolIdToView] = useState<string | null>(null);
  const [isCreatingNewTool, setIsCreatingNewTool] = useState(false);

  const { mutate, isError, isSuccess, isPending, reset } =
    useAgentsServiceAddToolToAgent();

  const queryClient = useQueryClient();

  const handleOpenChange = useCallback(
    (state: boolean) => {
      if (!state) {
        setIsCreatingNewTool(false);
        setToolIdToView(null);
        reset();
      }

      setOpen(state);
    },
    [reset]
  );

  const handleAddTool = useCallback(
    (toolId: string) => {
      mutate(
        {
          agentId,
          toolId,
        },
        {
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

            handleOpenChange(false);
          },
        }
      );
    },
    [agentId, handleOpenChange, mutate, queryClient]
  );

  const component = useMemo(() => {
    if (isCreatingNewTool) {
      return (
        <ToolCreator
          onClose={() => {
            setIsCreatingNewTool(false);
          }}
        />
      );
    }

    if (toolIdToView) {
      return (
        <SpecificToolComponent
          toolId={toolIdToView}
          onAddTool={{
            operation: () => {
              handleAddTool(toolIdToView);
            },
            isPending,
            isError,
            isSuccess,
          }}
          onClose={() => {
            setToolIdToView(null);
          }}
        />
      );
    }

    return (
      <AllToolsView
        startCreateNewTool={() => {
          setIsCreatingNewTool(true);
        }}
        setSelectedToolId={setToolIdToView}
      />
    );
  }, [
    handleAddTool,
    isCreatingNewTool,
    isError,
    isSuccess,
    isPending,
    setToolIdToView,
    toolIdToView,
  ]);

  const title = useMemo(() => {
    if (isCreatingNewTool) {
      return t('AddToolDialog.title.create');
    }

    if (toolIdToView) {
      return t('AddToolDialog.title.view');
    }

    return t('AddToolDialog.title.add');
  }, [isCreatingNewTool, t, toolIdToView]);

  return (
    <Dialog
      disableForm
      noContentPadding
      isOpen={open}
      color="background"
      errorMessage={isError ? t('AddToolDialog.error') : undefined}
      hideFooter
      trigger={
        <Button
          label={t('AddToolDialog.trigger')}
          color="tertiary"
          hideLabel
          preIcon={<PlusIcon />}
        />
      }
      title={title}
      onOpenChange={handleOpenChange}
      size="full"
    >
      {component}
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

interface ViewToolDialogProps {
  toolId: string;
  onClose: VoidFunction;
}

function ViewToolDialog(props: ViewToolDialogProps) {
  const { toolId, onClose } = props;

  const t = useTranslations('ADE/Tools');

  return (
    <Dialog
      size="full"
      color="background"
      disableForm
      noContentPadding
      hideFooter
      isOpen
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      title={t('ViewToolDialog.title')}
    >
      <SpecificToolComponent toolId={toolId} />
    </Dialog>
  );
}

function inferNameFromPythonCode(code: string) {
  const nameRegex = /def\s+(\w+)\s*\(/;
  const match = nameRegex.exec(code);

  return match ? match[1] : '';
}

interface ToolsProps {
  search: string;
}

function ToolsList(props: ToolsProps) {
  const { search } = props;
  const { tools: curentTools } = useCurrentAgent();
  const { data: _allTools, isLoading } = useToolsServiceListTools();
  const [toolIdToView, setToolIdToView] = useState<string | null>(null);

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

  const currentToolIdSet = useMemo(() => {
    return new Set((curentTools || []).map(({ id }) => id));
  }, [curentTools]);

  const currentUserTools = useMemo(() => {
    return allTools?.filter((tool) => currentToolIdSet.has(tool.id));
  }, [allTools, currentToolIdSet]);

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
            onClick: () => {
              setToolIdToView(tool.id || '');
            },
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
            onClick: () => {
              setToolIdToView(tool.id || '');
            },
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
    fileTreeTools[0].infoTooltip = {
      text: t('ToolsList.lettaCoreToolsInfo'),
    };
    fileTreeTools[1].name = t('ToolsList.otherTools', {
      toolCount: otherToolCount,
    });

    return fileTreeTools;
  }, [currentUserTools, search, t]);

  return (
    <PanelMainContent>
      {toolIdToView && (
        <ViewToolDialog
          toolId={toolIdToView}
          onClose={() => {
            setToolIdToView(null);
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
      {isLoading ? <LettaLoaderPanel /> : <FileTree root={toolsList} />}
    </PanelMainContent>
  );
}

interface ToolEditorProps {
  code: string;
  onSetCode: (code: string) => void;
}

function ToolEditor(props: ToolEditorProps) {
  const { code, onSetCode } = props;
  const t = useTranslations('ADE/Tools');
  const [completedAt, setCompletedAt] = useState<number | null>(null);

  const { mutate, error, submittedAt, reset, data, isPending } =
    useToolsServiceRunToolFromSource();

  const inputConfig = useMemo(
    () => ({
      defaultInput: {},
      schema: z.record(z.string(), z.any()),
      inputLabel: t('ToolEditor.inputLabel'),
    }),
    [t]
  );

  const extractedFunctionName = useMemo(() => {
    const nameRegex = /def\s+(\w+)\s*\(/;
    const match = nameRegex.exec(code);

    return match ? match[1] : '';
  }, [code]);

  const handleRun = useCallback(
    (input: z.infer<typeof inputConfig.schema>) => {
      reset();

      mutate(
        {
          requestBody: {
            name: extractedFunctionName,
            args: JSON.stringify(input),
            source_code: code,
          },
        },
        {
          onSuccess: () => {
            setCompletedAt(Date.now());
          },
        }
      );
    },
    [code, extractedFunctionName, inputConfig, mutate, reset]
  );

  const outputValue = useMemo(() => {
    if (error) {
      return JSON.stringify(error, null, 2);
    }

    if (data) {
      return JSON.stringify(data, null, 2);
    }

    return null;
  }, [data, error]);

  const outputStatus = useMemo(() => {
    if (error) {
      return 'error';
    }

    if (data) {
      if (data.status === 'error') {
        return 'error';
      }

      return 'success';
    }

    return undefined;
  }, [data, error]);

  return (
    <HStack flex overflow="hidden" fullWidth>
      <CodeEditor
        preLabelIcon={<CodeIcon />}
        collapseHeight
        fullWidth
        flex
        fullHeight
        language="python"
        // errorResponse={{
        //   title: t('ToolCreator.errorResponse'),
        //   content: errorMessage,
        //   onDismiss: () => {
        //     reset();
        //   },
        // }}
        fontSize="small"
        code={code}
        onSetCode={onSetCode}
        label={t('ToolCreator.sourceCode.label')}
      />
      <HiddenOnMobile>
        <Debugger
          preLabelIcon={<TerminalIcon />}
          outputConfig={{
            label: t('ToolEditor.outputLabel'),
          }}
          isRunning={isPending}
          onRun={handleRun}
          output={
            outputValue
              ? {
                  value: outputValue,
                  duration: completedAt ? completedAt - submittedAt : 0,
                  status: outputStatus,
                }
              : undefined
          }
          inputConfig={inputConfig}
          label={t('ToolEditor.label')}
        />
      </HiddenOnMobile>
    </HStack>
  );
}

interface ToolCreatorProps {
  onClose: VoidFunction;
}

interface ErrorMessageAlertProps {
  message: string;
  onDismiss: VoidFunction;
}

function ErrorMessageAlert(props: ErrorMessageAlertProps) {
  const { message, onDismiss } = props;
  const t = useTranslations('ADE/Tools');

  return (
    <Alert
      variant="destructive"
      title={t('ErrorMessageAlert.title')}
      onDismiss={onDismiss}
      fullWidth
    >
      <Code
        showLineNumbers={false}
        fontSize="small"
        language="javascript"
        code={message}
      />
    </Alert>
  );
}

const DEFAULT_SOURCE_CODE = `def roll_d20():
    """
    Simulate the roll of a 20-sided die (d20).

    This function generates a random integer between 1 and 20, inclusive,
    which represents the outcome of a single roll of a d20.

    Returns:
        str: The result of the die roll.
    """
    import random
    dice_role_outcome = random.randint(1, 20)
    output_string = f"You rolled a {dice_role_outcome}"
    return output_string
`;

function ToolCreator(props: ToolCreatorProps) {
  const { onClose } = props;
  const t = useTranslations('ADE/Tools');

  const createToolSchema = useMemo(() => {
    return z.object({
      sourceCode: z.string(),
    });
  }, []);

  const queryClient = useQueryClient();

  const {
    mutate,
    error,
    isPending: isCreatingTool,
    reset,
    isSuccess,
  } = useToolsServiceCreateTool({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: UseToolsServiceListToolsKeyFn(),
      });

      onClose();
    },
  });

  const form = useForm<z.infer<typeof createToolSchema>>({
    resolver: zodResolver(createToolSchema),
    defaultValues: {
      sourceCode: DEFAULT_SOURCE_CODE,
    },
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createToolSchema>) => {
      mutate({
        requestBody: {
          tags: [],
          source_type: 'python',
          description: '',
          name: inferNameFromPythonCode(values.sourceCode),
          source_code: values.sourceCode,
        },
      });
    },
    [mutate]
  );

  const { isLocal } = useCurrentAgentMetaData();

  const errorMessage = useMemo(() => {
    if (!error) {
      return '';
    }

    const defaultError = !isLocal
      ? { message: 'Unhandled error, please contact support' }
      : error;

    let message: unknown = '';

    if (isAPIError(error)) {
      message = error.body;
    }

    return JSON.stringify(message || defaultError, null, 2);
  }, [error, isLocal]);

  return (
    <VStack flex collapseHeight paddingBottom>
      {errorMessage && (
        <ErrorMessageAlert message={errorMessage} onDismiss={reset} />
      )}
      <VStack flex collapseHeight paddingTop paddingX fullWidth>
        <FormProvider {...form}>
          <Form onSubmit={form.handleSubmit(handleSubmit)}>
            <VStack fullHeight flex gap="form" fullWidth>
              <FormField
                control={form.control}
                name="sourceCode"
                render={({ field }) => (
                  <ToolEditor code={field.value} onSetCode={field.onChange} />
                )}
              />
              <FormActions>
                <Button
                  color="tertiary"
                  label={t('SpecificToolComponent.back')}
                  onClick={() => {
                    onClose();
                  }}
                />
                <Button
                  type="submit"
                  label="Create"
                  color="secondary"
                  busy={isCreatingTool || isSuccess}
                />
              </FormActions>
            </VStack>
          </Form>
        </FormProvider>
      </VStack>
    </VStack>
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
        actions={<AddToolDialog />}
      />
      <ToolsList search={search} />
    </>
  );
}

export const toolsPanelTemplate = {
  templateId: 'tools-panel',
  content: ToolsListPage,
  icon: <ToolsIcon />,
  useGetMobileTitle: () => {
    const t = useTranslations('ADE/Tools');

    return t('mobileTitle');
  },
  useGetInfoTooltipText: () => {
    const t = useTranslations('ADE/Tools');

    return t('infoTooltip');
  },
  useGetTitle: () => {
    const t = useTranslations('ADE/Tools');
    const { tools } = useCurrentAgent();

    return t('title', {
      toolCount: tools?.length || '-',
    });
  },
  data: z.undefined(),
} satisfies PanelTemplate<'tools-panel'>;
