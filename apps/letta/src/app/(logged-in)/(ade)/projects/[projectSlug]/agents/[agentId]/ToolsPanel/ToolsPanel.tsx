'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ComposioLockup,
  ComposioLogoMark, DashboardPageSection,
  DataTable, ExploreIcon,
  FileTreeContentsType, IconWrapper, InlineCode, LoadingEmptyStatusComponent, NiceGridDisplay,
  PanelTemplate, toast
} from '@letta-web/component-library';
import {
  CloseIcon, MiniApp
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
  HStack,
} from '@letta-web/component-library';
import { useCurrentAgent } from '../hooks';
import {
  AgentState,
  GetToolResponse,
  letta__schemas__tool__Tool, useToolsServiceListComposioApps
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
import { webApi, webApiQueryKeys } from '$letta/client';
import Image from 'next/image';
import { ToolMetadataPreviewType } from '$letta/web-api/tool-metadata/toolMetadataContract';
import { COMPOSIO_KEY_NAME } from '$letta/web-api/environment-variables/environmentVariablesContracts';

interface AllToolsViewProps {
  setSelectedToolId: (toolId: string) => void;
  startCreateNewTool: VoidFunction;
}

interface ToolCategoryButtonProps {
  category: ToolViewerCategory;
  label: string;
  image?: string;
  selectedCategory: ToolViewerCategory;
  setSelectedCategory: (category: ToolViewerCategory) => void;
}

function ToolCategoryButton(props: ToolCategoryButtonProps) {
  const { category, image, label, selectedCategory, setSelectedCategory } = props;


  return (
    <Button
      label={label}
      preIcon={image ? <img src={image} alt="" /> : <ToolsIcon />}
      color="tertiary-transparent"
      active={selectedCategory === category}
      onClick={() => {
        setSelectedCategory(category)
      }}
    />
  );
}


// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type ToolViewerCategory = string | 'all' | 'custom';

interface ViewCategoryToolsProps {
  category: ToolViewerCategory;
  onSelectTool: (tool: ToolMetadataPreviewType | null) => void;
}


const PAGE_SIZE = 100;


function ViewCategoryTools(props: ViewCategoryToolsProps) {
  const { category, onSelectTool } = props;

  const [search, setSearch] = useState<string>('')

  const query = useMemo(() => ({
    brand: ['all', 'custom'].includes(category) ? undefined : category,
    search,
  }), [category, search]);

  const { data: toolMetaData, isLoading: isLoadingToolMetaData, fetchNextPage, hasNextPage: hasNextToolMetaData } = webApi.toolMetadata.listToolMetadata.useInfiniteQuery({
    queryKey: webApiQueryKeys.toolMetadata.listToolMetadataWithSearch(query),
    queryData: ({ pageParam }) => ({
      query: {
        ...query,
        offset: pageParam.offset,
        limit: pageParam.limit,
      },
    }),
    initialPageParam: { offset: 0, limit: PAGE_SIZE },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.body.hasNextPage
        ? { limit: PAGE_SIZE, offset: allPages.length * PAGE_SIZE }
        : undefined;
    },
    enabled: category !== 'custom',
  });

  const { data: customTools, isLoading: isLoadingCustomTools } = useToolsServiceListTools({
    limit: 100,
  }, undefined, {
    enabled: category === 'custom',
  });


  const hasNextPage = useMemo(() => {
    return category === 'custom' ? false : hasNextToolMetaData;
  }, [category, hasNextToolMetaData]);

  const isLoading = useMemo(() => {
    return isLoadingToolMetaData || isLoadingCustomTools;
  }, [isLoadingToolMetaData, isLoadingCustomTools]);

  const tools: ToolMetadataPreviewType[] = useMemo(() => {
    if (category === 'custom') {
      if (!customTools) {
        return [];
      }

      return customTools
        .filter(tool => {
          if (!tool.tags) {
            return false;
          }

          return !(tool.tags.includes('letta-base') || tool.tags.includes('memgpt-base'))
        })
        .map((tool) => ({
        name: tool.name || '',
        description: tool.description || '',
        id: tool.id || '',
        brand: 'custom',
        provider: 'custom',
        imageUrl: null,
      }));
    }

    return toolMetaData?.pages.flatMap((page) => page.body.toolMetadata) || [];
  }, [category, customTools, toolMetaData?.pages]);

  const t = useTranslations('ADE/Tools');

  return (
    <VStack overflow="hidden" gap="large" fullHeight fullWidth>
      <HStack paddingX align="center" justify="spaceBetween">
        <VStack>
          <RawInput
            hideLabel
            preIcon={<SearchIcon />}
            placeholder={t('ViewCategoryTools.search.placeholder')}
            label={t('ViewCategoryTools.search.label')} fullWidth value={search} onChange={(e) => {
            setSearch(e.target.value);
          }}
          />
        </VStack>
        <Button
          label={t('ViewCategoryTools.create')}
          color="secondary"
          onClick={() => {
            onSelectTool(null);
          }}
        />
      </HStack>
      <VStack paddingX overflowY="auto">

        {!isLoading ? (
          <VStack>
            <NiceGridDisplay>
              {tools
                .map((tool) => (
                  <ActionCard
                    key={tool.id}
                    title={tool.name}
                    subtitle={isBrandKey(tool.brand) ? brandKeyToName(tool.brand) : tool.brand}
                    icon={tool.imageUrl ? (
                      <img src={tool.imageUrl} alt="" />
                    ) : <ToolsIcon />}

                    mainAction={(
                      <Button
                        color="tertiary"
                        label={t('ViewCategoryTools.view')}
                        onClick={() => {
                          onSelectTool(tool);
                        }}
                      />
                    )}
                  >
                    {/* eslint-disable-next-line react/forbid-component-props */}
                    <Typography className="line-clamp-3">
                      {tool.description}
                    </Typography>
                  </ActionCard>
                ))}
            </NiceGridDisplay>
            {hasNextPage && <Button fullWidth color="tertiary" label={t('ViewCategoryTools.loadMore')} onClick={() => {
              void fetchNextPage();
            }} />}
          </VStack>

        ) : (
          <LoadingEmptyStatusComponent emptyMessage="" isLoading />
        )}
      </VStack>
    </VStack>
  )
}

function filterOutBaseTools(tools: letta__schemas__tool__Tool[]) {
  return tools.filter(tool => !tool.tags?.includes('letta-base') && !tool.tags?.includes('memgpt-base'));
}


function AllToolsView() {
  const [toolToView, setToolToView] = useState<ToolMetadataPreviewType | null>(null);

  const { data: summary } = webApi.toolMetadata.getToolMetadataSummary.useQuery({
    queryKey: webApiQueryKeys.toolMetadata.getToolMetadataSummary,
  });

  const { data: groupMetaData } = webApi.toolMetadata.listToolGroupMetadata.useQuery({
    queryKey: webApiQueryKeys.toolMetadata.listToolMetadataWithSearch({
      limit: 200,
    }),
    queryData: {
      query: {
        limit: 200,
      }
    }
  });

  const [category, setCategory] = useState<ToolViewerCategory>('all');

  const t = useTranslations('ADE/Tools');

  const [categorySearch, setCategorySearch] = useState('');

  const content = useMemo(() => {
    if (toolToView) {
      return <ViewTool showAddToolToAgent tool={toolToView} />;
    }


    return <ViewCategoryTools onSelectTool={setToolToView} category={category} />
  }, [category, toolToView]);


  const brandIntegrations = useMemo(() => {
    return (groupMetaData?.body.toolGroups || [])
      .filter(({ brand, toolCount }) => toolCount > 0 && isBrandKey(brand))
      .map(({ brand, toolCount, imageUrl }) => {
        return {
          name: isBrandKey(brand) ? brandKeyToName(brand) : 'Unknown',
          description: '',
          imageUrl,
          category: brand,
          toolCount,
        };
      })
  }, [groupMetaData?.body.toolGroups]);

  const title = useMemo(() => {
    if (category === 'all') {
      return t('AllToolsView.titles.allTools');
    }

    if (category === 'custom') {
      return t('AllToolsView.titles.customTools');
    }

    if (isBrandKey(category)) {
      return t('AllToolsView.titles.brandTools', {
        brand: brandKeyToName(category),
      });
    }

    return '';
  }, [category, t]);

  const handleSelectCategory = useCallback((category: ToolViewerCategory) => {
    setCategory(category);
    setToolToView(null);
  }, []);

  const { data: customTools, isLoading: isLoadingCustomTools } = useToolsServiceListTools({
    limit: 100,
  });

  const customToolCount = useMemo(() => {
    if (isLoadingCustomTools) {
      return '-';
    }

    if (!customTools) {
      return 0;
    }

    return filterOutBaseTools(customTools).length;
  }, [customTools, isLoadingCustomTools]);

  return (
    <HStack fullHeight gap={false}>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="min-w-[350px] visibleSidebar:flex hidden" borderRight>
        <VStack gap="large" justify="center" padding paddingBottom="small" borderBottom fullWidth>
          <HStack align="center" gap="medium">
            <ExploreIcon size="large" />
            <Typography align="left" variant="heading4">
              {t('AllToolsView.title')}
            </Typography>
          </HStack>
          <HStack paddingBottom="small">
            <RawInput
              fullWidth
              preIcon={<SearchIcon />}
              hideLabel
              placeholder={t('AllToolsView.searchCategories.placeholder')}
              label={t('AllToolsView.searchCategories.label')}
              value={categorySearch}
              onChange={(e) => {
                setCategorySearch(e.target.value);
              }}
            />
          </HStack>
        </VStack>

        <VStack overflowY="auto" paddingX="small" gap="small">

          {summary?.body ? (
            <>
              <ToolCategoryButton
                category="all"
                label={t('AllToolsView.categories.allTools', {
                  count: summary?.body.allToolsCount || 0,
                })}
                selectedCategory={category}
                setSelectedCategory={handleSelectCategory}
              />
              <ToolCategoryButton
                category="custom"
                selectedCategory={category}
                label={t('AllToolsView.categories.customTools', {
                  count: customToolCount,
                })}
                setSelectedCategory={handleSelectCategory}
              />
              {brandIntegrations
                .filter(brandIntegration => brandIntegration.name.toLowerCase().includes(categorySearch.toLowerCase()))
                .map((brandIntegration) => (
                <ToolCategoryButton
                  image={brandIntegration.imageUrl || ''}
                  key={brandIntegration.category}
                  category={brandIntegration.category}
                  selectedCategory={category}
                  label={t('AllToolsView.categories.brandTools', {
                    count: brandIntegration.toolCount,
                    brand: brandIntegration.name,
                  })}
                  setSelectedCategory={handleSelectCategory}
                />
              ))}
            </>
          ) : (
            <LoadingEmptyStatusComponent emptyMessage="" isLoading />
          )}
        </VStack>
      </VStack>
      <VStack gap={false} fullHeight fullWidth>
        <HStack height="header" align="center" justify="spaceBetween" paddingX fullWidth>
          {toolToView ? (
            <Button
              label={t('AllToolsView.back')}
              color="tertiary-transparent"
              size="small"
              preIcon={<ChevronLeftIcon />}
              onClick={() => {
                setToolToView(null);
              }}
            />
          ) : (
            <Typography bold>
              {title}
            </Typography>
          )}
          <CloseIcon />
        </HStack>
        {content}
      </VStack>
    </HStack>
  );
}

interface ViewToolCodePreviewProps {
  toolId: string;
  provider: string;
}

function ViewToolCodePreview(props: ViewToolCodePreviewProps) {
  const { toolId, provider } = props;
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const t = useTranslations('ADE/Tools');
  const { data: tool } = useToolsServiceGetTool({
    toolId
  }, undefined, {
    enabled: ['letta', 'custom'].includes(provider),
  });

  if (provider === 'composio') {
    return null;
  }

  return (
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
        label={t('ViewToolCodePreview.viewToggle.label')}
        items={[
          {
            label: t('ViewToolCodePreview.viewToggle.options.code'),
            value: 'code',
            icon: <CodeIcon />,
          },
          {
            label: t('ViewToolCodePreview.viewToggle.options.schema'),
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
  )
}


function useIsComposioConnected() {
  const { isLocal } = useCurrentAgentMetaData();


  const { data: keyExistence } = webApi.environmentVariables.getEnvironmentVariableByKey.useQuery({
    queryKey: webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(COMPOSIO_KEY_NAME),
    queryData: {
      params: {
        key: COMPOSIO_KEY_NAME,
      }
    },
    enabled: !isLocal,
  });

  const { data: isLocalComposioConnected } = useToolsServiceListComposioApps({ }, undefined, {
    enabled: isLocal ,
  })

  return  useMemo(() => {
    return isLocal ? isLocalComposioConnected : keyExistence?.status === 200;
  }, [isLocal, isLocalComposioConnected, keyExistence?.status])
}

type ViewMode = 'code' | 'schema';

interface AddToolToAgentButtonProps {
  toolId: string;
  provider: string;
}

function AddToolToAgentButton(props: AddToolToAgentButtonProps) {
  const { toolId, provider } = props;

  const t = useTranslations('ADE/Tools');

  const isComposioTool = useMemo(() => {
    return provider === 'composio';
  }, [provider]);

  const isComposioConnected = useIsComposioConnected();
  const { id: agentId } = useCurrentAgent();

  const { mutate, isPending } =
    useAgentsServiceAddToolToAgent({
      onError: () => {
        toast.error(t('AddToolToAgentButton.error'));
      }
    });

  const queryClient = useQueryClient();

  const { data: currentToolToAdd } = useToolsServiceGetTool(
    {
      toolId,
    },
    undefined,
    {
      enabled: !!toolId,
    }
  );

  const handleAddTool = useCallback(
    () => {
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
                  tool_names: nextAgentState.tool_names,
                  tools: [
                    {
                      id: toolId,
                      name: currentToolToAdd?.name || '',
                      description: currentToolToAdd?.description || '',
                      source_code: currentToolToAdd?.source_code || '',
                    },
                    ...oldData.tools,
                  ],
                };
              }
            );
          },
        }
      );
    },
    [agentId, toolId, currentToolToAdd, mutate, queryClient]
  );


  const { tools } = useCurrentAgent();

  const isToolInAgent = useMemo(() => {
    return (tools || []).some(aTool => aTool.id === toolId);
  }, [toolId, tools]);

  const disableAttach = useMemo(() => {
    if (isComposioTool) {
      return !isComposioConnected;
    }

    return isToolInAgent;
  }, [isComposioConnected, isComposioTool, isToolInAgent]);

  if (isToolInAgent) {
    return (
      <Button
        size="small"
        label={t('AddToolToAgentButton.alreadyAdded')}
        color="tertiary"
        disabled
      />
    )
  }

  return (
    <Button
      size="small"
      preIcon={<PlusIcon />}
      busy={isPending}
      label={t('AddToolToAgentButton.attach')}
      color={disableAttach ? 'tertiary' : 'secondary'}
      onClick={handleAddTool}
      disabled={!!disableAttach}
    />
  )
}

interface ViewToolProps {
  tool: ToolMetadataPreviewType;
  showAddToolToAgent?: boolean
}


function ViewTool(props: ViewToolProps) {
  const { tool, showAddToolToAgent } = props;

  const t = useTranslations('ADE/Tools');


  const toolDescription = useMemo(() => {
    if (!tool) {
      return undefined;
    }

    return tool.description || t('SpecificToolComponent.noDescription');
  }, [t, tool]);

  const isComposioTool = useMemo(() => {
    return tool.provider === 'composio';
  }, [tool]);

  const isComposioConnected = useIsComposioConnected();
  const { isLocal } = useCurrentAgentMetaData();

  return (
    <VStack overflowY="auto" paddingX paddingBottom fullHeight flex>
      {!isComposioConnected && isComposioTool && (
        <Alert
          variant="warning"
          action={!isLocal && (
            <Button
              target="_blank"
              href="/settings/organization/integrations/composio"
              label={t('ViewTool.connectComposio.connect')}
              color="secondary"
            />
          )}
          title={t('ViewTool.connectComposio.title')}>
          {isLocal ? (
            <Typography>
              {t.rich('ViewTool.connectComposio.descriptionLocal', {
                code: (chunks) => <InlineCode code={`${chunks}`} />,
              })}
            </Typography>
          ) : (
            <Typography>
              {t('ViewTool.connectComposio.descriptionRemote')}
            </Typography>
          )}

        </Alert>
      )}
      <VStack gap="large" paddingBottom fullWidth>
        <HStack fullWidth align="center">
          <div className="w-[100px] p-5">
            {tool.imageUrl ? (
              <IconWrapper
                /* eslint-disable-next-line react/forbid-component-props */
                className="w-full"
              >
                <img src={tool.imageUrl} alt="" />
              </IconWrapper>
            ) : (
              <ToolsIcon
                /* eslint-disable-next-line react/forbid-component-props */
                className="w-full"
              />
            )}
          </div>

          <VStack fullWidth gap={false}>
            <HStack align="center">
              <Typography
                align="left"
                variant="heading2">
                {tool.name}
              </Typography>

            </HStack>
            <HStack align="center" gap="small">
              <Typography overrideEl="span" align="left" italic>{
                isBrandKey(tool.brand) ? brandKeyToName(tool.brand) : tool.brand
              }{' '}</Typography>
              {isComposioTool && (
                <Typography
                  noWrap
                  inline
                  overrideEl="span">
                  {t('ViewTool.viaComposioTool')}
                </Typography>
              )}
              <div className="mt-[2px]">
                <ComposioLockup height={20} />
              </div>
            </HStack>
            {showAddToolToAgent && (
              <HStack paddingTop="small">
                <AddToolToAgentButton toolId={tool.id} provider={tool.provider} />
              </HStack>
            )}
          </VStack>
        </HStack>
        <VStack width="largeContained" fullWidth>

          <Typography
            bold
            variant="heading6"
          >{t('SpecificToolComponent.description')}</Typography>
          <Typography fullWidth variant="body" italic={!tool?.description}>
            {toolDescription?.replace(/\n|\t/g, ' ').trim()}
          </Typography>
        </VStack>
      </VStack>
      <div className="min-h-[400px] w-full flex-1 flex flex-col">
        <ViewToolCodePreview toolId={tool.id} provider={tool.provider} />
      </div>
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
        <ViewTool tool={{
          name: tool.name,
          description: tool.description,
          id: tool.id,
          brand: tool.brand,
          provider: 'custom',
        }} />
      )}
    </VStack>
  );
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

  const { data: currentToolToAdd } = useToolsServiceGetTool(
    {
      toolId: toolIdToView || '',
    },
    undefined,
    {
      enabled: !!toolIdToView,
    }
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
                  tool_names: nextAgentState.tool_names,
                  tools: [
                    {
                      id: toolId,
                      name: currentToolToAdd?.name || '',
                      description: currentToolToAdd?.description || '',
                      source_code: currentToolToAdd?.source_code || '',
                    },
                    ...oldData.tools,
                  ],
                };
              }
            );

            handleOpenChange(false);
          },
        }
      );
    },
    [agentId, currentToolToAdd, handleOpenChange, mutate, queryClient]
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
      <AllToolsView />
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

  return (
    <MiniApp
      isOpen={open}
      defaultOpen
      trigger={
        <Button
          label={t('AddToolDialog.trigger')}
          color="tertiary"
          hideLabel
          preIcon={<PlusIcon />}
        />
      }
      onOpenChange={handleOpenChange}
    >
      {component}
    </MiniApp>
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
            tool_names: nextAgentState.tool_names,
            tools: nextAgentState.tools.filter((tool) => tool.id !== toolId),
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
  const { tools: currentTools } = useCurrentAgent();
  const [toolIdToView, setToolIdToView] = useState<string | null>(null);

  const t = useTranslations('ADE/Tools');

  const [removeToolPayload, setRemoveToolPayload] =
    useState<RemoveToolPayload | null>(null);

  const toolsList: FileTreeContentsType = useMemo(() => {
    if (!currentTools) {
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

    currentTools.forEach((tool) => {
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
  }, [currentTools, search, t]);

  return (
    <PanelMainContent>
      {toolIdToView && (
        <div />
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
      <FileTree root={toolsList} />
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
