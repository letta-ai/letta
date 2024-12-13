import type { ToolMetadataPreviewType } from '$letta/web-api/tool-metadata/toolMetadataContract';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCurrentAgent } from '../hooks';
import type {
  AgentState,
  letta__schemas__tool__Tool,
} from '@letta-web/letta-agents-api';
import {
  type GetToolResponse,
  isAPIError,
  useToolsServiceAddComposioTool,
  useToolsServiceCreateTool,
  UseToolsServiceGetToolKeyFn,
  UseToolsServiceListToolsKeyFn,
  useToolsServiceRunToolFromSource,
  useToolsServiceUpdateTool,
} from '@letta-web/letta-agents-api';
import {
  useAgentsServiceAddToolToAgent,
  UseAgentsServiceGetAgentKeyFn,
  useToolsServiceGetTool,
  useToolsServiceListComposioApps,
  useToolsServiceListTools,
} from '@letta-web/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionCard,
  Alert,
  brandKeyToName,
  Breadcrumb,
  Button,
  ChevronLeftIcon,
  CloseIcon,
  CloseMiniApp,
  Code,
  CodeIcon,
  ComposioLockup,
  Debugger,
  Dialog,
  ExploreIcon,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HStack,
  IconWrapper,
  InlineCode,
  isBrandKey,
  ListIcon,
  LoadedTypography,
  LoadingEmptyStatusComponent,
  MiniApp,
  NiceGridDisplay,
  PlusIcon,
  RawCodeEditor,
  RawInput,
  RawToggleGroup,
  SearchIcon,
  TerminalIcon,
  toast,
  ToolsIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { useFeatureFlag, webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { COMPOSIO_KEY_NAME } from '$letta/web-api/environment-variables/environmentVariablesContracts';
import { atom, useAtom } from 'jotai';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';

type ToolViewerState = 'edit' | 'view';

interface ToolExplorerCurrentToolState
  extends Partial<ToolMetadataPreviewType> {
  id: string;
  provider: string;
}

interface ViewOrEditState {
  data: ToolExplorerCurrentToolState;
  mode: ToolViewerState;
}

interface ToolsExplorerContextState {
  currentTool?: ViewOrEditState | { mode: 'create' };
  isOpen: boolean;
}

function isCurrentToolInViewOrEdit(
  state: ToolsExplorerContextState['currentTool']
): state is ViewOrEditState {
  return !!(state && Object.prototype.hasOwnProperty.call(state, 'data'));
}

const toolsExplorerAtom = atom<ToolsExplorerContextState>({
  currentTool: undefined,
  isOpen: false,
});

interface ToolCategoryButtonProps {
  category: ToolViewerCategory;
  label: string;
  image?: string;
  selectedCategory: ToolViewerCategory;
  setSelectedCategory: (category: ToolViewerCategory) => void;
}

function ToolCategoryButton(props: ToolCategoryButtonProps) {
  const { category, image, label, selectedCategory, setSelectedCategory } =
    props;

  return (
    <Button
      label={label}
      preIcon={image ? <img src={image} alt="" /> : <ToolsIcon />}
      color="tertiary-transparent"
      active={selectedCategory === category}
      onClick={() => {
        setSelectedCategory(category);
      }}
    />
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
  const { data: tool } = useToolsServiceGetTool(
    {
      toolId,
    },
    undefined,
    {
      enabled: ['letta', 'custom'].includes(provider),
    }
  );

  if (provider === 'composio') {
    return null;
  }

  return (
    <div className="min-h-[400px] w-full flex-1 flex flex-col">
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
    </div>
  );
}

function EditToolButton() {
  const t = useTranslations('ADE/Tools');
  const { switchToolState } = useToolsExplorerState();

  return (
    <Button
      size="small"
      onClick={() => {
        switchToolState('edit');
      }}
      label={t('EditToolButton.title')}
      color="tertiary"
    />
  );
}

function useIsComposioConnected() {
  const { isLocal } = useCurrentAgentMetaData();

  const { data: keyExistence, isLoading: isLoadingKey } =
    webApi.environmentVariables.getEnvironmentVariableByKey.useQuery({
      queryKey:
        webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
          COMPOSIO_KEY_NAME
        ),
      queryData: {
        params: {
          key: COMPOSIO_KEY_NAME,
        },
      },
      enabled: !isLocal,
    });

  const { data: isLocalComposioConnected, isLoading: isLoadingLocal } =
    useToolsServiceListComposioApps({}, undefined, {
      enabled: isLocal,
    });

  const isConnected = useMemo(() => {
    return isLocal ? isLocalComposioConnected : keyExistence?.status === 200;
  }, [isLocal, isLocalComposioConnected, keyExistence?.status]);

  const isLoading = useMemo(() => {
    return isLoadingKey || isLoadingLocal;
  }, [isLoadingKey, isLoadingLocal]);

  return {
    isConnected,
    isLoading,
  };
}

type ViewMode = 'code' | 'schema';

interface AddToolToAgentButtonProps {
  tool: ToolMetadataPreviewType;
}

function AddToolToAgentButton(props: AddToolToAgentButtonProps) {
  const { tool } = props;

  const { provider } = tool;

  const t = useTranslations('ADE/Tools');

  const isComposioTool = useMemo(() => {
    return provider === 'composio';
  }, [provider]);

  const { isConnected: isComposioConnected } = useIsComposioConnected();
  const { id: agentId } = useCurrentAgent();

  const [isPending, setIsPending] = useState(false);

  const { mutateAsync: attachToolToAgent } = useAgentsServiceAddToolToAgent({
    onError: () => {
      toast.error(t('AddToolToAgentButton.error'));
    },
  });

  const queryClient = useQueryClient();

  const { mutateAsync: addComposioTool } = useToolsServiceAddComposioTool();

  const handleAddTool = useCallback(async () => {
    try {
      setIsPending(true);

      let toolIdToAdd = '';

      if (isComposioTool) {
        if (!tool.providerId) {
          throw new Error('No providerId found for Composio app');
        }

        const response = await addComposioTool({
          composioActionName: tool.providerId,
        });

        toolIdToAdd = response.id || '';
      } else {
        toolIdToAdd = tool.id;
      }

      const nextAgentState = await attachToolToAgent({
        agentId,
        toolId: toolIdToAdd,
      });

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
                id: toolIdToAdd,
                name: tool.providerId?.toLowerCase() || tool.name || '',
                description: tool.description || '',
                source_code: '',
                tags: [tool.provider],
              },
              ...nextAgentState.tools,
            ],
          };
        }
      );
    } catch (_e) {
      toast.error(t('AddToolToAgentButton.error'));
    } finally {
      setIsPending(false);
    }
  }, [
    addComposioTool,
    agentId,
    attachToolToAgent,
    isComposioTool,
    queryClient,
    t,
    tool.description,
    tool.id,
    tool.name,
    tool.provider,
    tool.providerId,
  ]);

  const { tools } = useCurrentAgent();

  const isToolInAgent = useMemo(() => {
    if (isComposioTool) {
      return (tools || []).some((aTool) => {
        if (
          (aTool.name || '').toLowerCase() === tool.providerId?.toLowerCase() &&
          findProviderFromTags(aTool) === 'composio'
        ) {
          return true;
        }

        return false;
      });
    }

    return (tools || []).some((aTool) => aTool.id === tool.id);
  }, [isComposioTool, tool, tools]);

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
    );
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
  );
}

interface ViewToolProps {
  tool: ToolExplorerCurrentToolState;
  showAddToolToAgent?: boolean;
}

function ViewTool(props: ViewToolProps) {
  const { tool: baseTool, showAddToolToAgent } = props;

  const t = useTranslations('ADE/Tools');

  const isCustomOrLettaProvider = useMemo(() => {
    return ['letta', 'custom'].includes(baseTool.provider);
  }, [baseTool.provider]);

  const { data: localTool } = useToolsServiceGetTool(
    {
      toolId: baseTool.id,
    },
    undefined,
    {
      enabled: isCustomOrLettaProvider,
    }
  );

  const { data: toolMetaData } = webApi.toolMetadata.listToolMetadata.useQuery({
    queryKey: webApiQueryKeys.toolMetadata.listToolMetadataWithSearch({
      providerId: baseTool.providerId || '',
    }),
    queryData: {
      query: {
        providerId: baseTool.providerId?.toUpperCase() || '',
      },
    },
    enabled: !isCustomOrLettaProvider,
  });

  const tool: ToolMetadataPreviewType = useMemo(() => {
    if (isCustomOrLettaProvider) {
      return {
        name: localTool?.name || baseTool.name || '',
        description: localTool?.description || baseTool.description || '',
        id: localTool?.id || baseTool.id || '',
        brand: baseTool.provider,
        provider: localTool
          ? findProviderFromTags(localTool)
          : baseTool.provider,
        imageUrl: null,
        providerId: '',
      };
    }

    const metaDataTool = toolMetaData?.body.toolMetadata[0];

    return {
      name: metaDataTool?.name || baseTool.name || '',
      description: metaDataTool?.description || baseTool.description || '',
      id: metaDataTool?.id || baseTool.id || '',
      brand: metaDataTool?.brand || baseTool.brand || 'custom',
      provider: metaDataTool?.provider || baseTool.provider,
      imageUrl: metaDataTool?.imageUrl || baseTool.provider,
      providerId: metaDataTool?.providerId || baseTool.providerId,
    };
  }, [
    baseTool.brand,
    baseTool.description,
    baseTool.id,
    baseTool.name,
    baseTool.provider,
    baseTool.providerId,
    isCustomOrLettaProvider,
    localTool,
    toolMetaData?.body.toolMetadata,
  ]);

  const toolDescription = useMemo(() => {
    if (!tool) {
      return undefined;
    }

    return tool.description || t('SpecificToolComponent.noDescription');
  }, [t, tool]);

  const isComposioTool = useMemo(() => {
    return tool.provider === 'composio';
  }, [tool]);

  const {
    isConnected: isComposioConnected,
    isLoading: isComposioConnectedLoading,
  } = useIsComposioConnected();
  const { isLocal } = useCurrentAgentMetaData();

  const isEditable = useMemo(() => {
    return tool.provider === 'custom';
  }, [tool.provider]);

  const showComposioSetupBanner = useMemo(() => {
    if (isComposioConnectedLoading) {
      return false;
    }

    return isComposioTool && !isComposioConnected;
  }, [isComposioConnected, isComposioConnectedLoading, isComposioTool]);

  return (
    <VStack overflowY="auto" paddingX paddingBottom fullHeight flex>
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

          <VStack fullWidth gap="medium">
            <VStack gap={false}>
              <HStack align="center">
                <LoadedTypography
                  text={tool.name}
                  fillerText="This is a placeholder"
                  align="left"
                  variant="heading2"
                />
              </HStack>
              <HStack align="center" gap="small">
                <Typography overrideEl="span" align="left" italic>
                  {isBrandKey(tool.brand)
                    ? brandKeyToName(tool.brand)
                    : tool.brand}{' '}
                </Typography>
                {isComposioTool && (
                  <>
                    <Typography noWrap inline overrideEl="span">
                      {t('ViewTool.viaComposioTool')}
                    </Typography>
                    <div className="mt-[2px]">
                      <ComposioLockup height={20} />
                    </div>
                  </>
                )}
              </HStack>
            </VStack>
            <HStack>
              {showAddToolToAgent && <AddToolToAgentButton tool={tool} />}
              {isEditable && <EditToolButton />}
              {isComposioTool && (
                <Button
                  target="_blank"
                  size="small"
                  href={`https://app.composio.dev/app/${tool.brand}`}
                  label={t('ViewTool.viewOnComposio')}
                  color="tertiary"
                />
              )}
            </HStack>
          </VStack>
        </HStack>
        {showComposioSetupBanner && (
          <Alert variant="warning" title={t('ViewTool.connectComposio.title')}>
            <VStack>
              {isLocal ? (
                <Typography overrideEl="span">
                  {t.rich('ViewTool.connectComposio.descriptionLocal', {
                    code: (chunks) => <InlineCode code={`${chunks}`} />,
                  })}
                </Typography>
              ) : (
                <Typography overrideEl="span">
                  {t('ViewTool.connectComposio.descriptionRemote')}
                </Typography>
              )}
              {!isLocal && (
                <HStack>
                  <Button
                    target="_blank"
                    href="/settings/organization/integrations/composio"
                    label={t('ViewTool.connectComposio.connect')}
                    color="secondary"
                  />
                </HStack>
              )}
            </VStack>
          </Alert>
        )}
        <VStack width="largeContained" fullWidth>
          <Typography bold variant="heading6">
            {t('SpecificToolComponent.description')}
          </Typography>
          <Typography fullWidth variant="body" italic={!tool?.description}>
            {toolDescription?.replace(/\n|\t/g, ' ').trim()}
          </Typography>
        </VStack>
      </VStack>

      <ViewToolCodePreview toolId={tool.id} provider={tool.provider} />
    </VStack>
  );
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type ToolViewerCategory = string | 'all' | 'custom';

interface ViewCategoryToolsProps {
  category: ToolViewerCategory;
}

const PAGE_SIZE = 100;

function ViewCategoryTools(props: ViewCategoryToolsProps) {
  const { category } = props;

  const { setCurrentTool, startCreateTool } = useToolsExplorerState();
  const [search, setSearch] = useState<string>('');

  const query = useMemo(
    () => ({
      brand: ['all', 'custom'].includes(category) ? undefined : category,
      search,
    }),
    [category, search]
  );

  const {
    isLoading: isLoadingShowComposioTools,
    data: isShowComposioToolsEnabled,
  } = useFeatureFlag('SHOW_COMPOSIO_TOOLS');

  const shouldShowComposioTools = useMemo(() => {
    return !isLoadingShowComposioTools && isShowComposioToolsEnabled;
  }, [isLoadingShowComposioTools, isShowComposioToolsEnabled]);

  const {
    data: toolMetaData,
    isLoading: isLoadingToolMetaData,
    fetchNextPage,
    hasNextPage: hasNextToolMetaData,
  } = webApi.toolMetadata.listToolMetadata.useInfiniteQuery({
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
    enabled: shouldShowComposioTools && category !== 'custom',
  });

  const { data: customTools, isLoading: isLoadingCustomTools } =
    useToolsServiceListTools(
      {
        limit: 100,
      },
      undefined,
      {
        enabled: ['all', 'custom'].includes(category),
      }
    );

  const hasNextPage = useMemo(() => {
    return category === 'custom' ? false : hasNextToolMetaData;
  }, [category, hasNextToolMetaData]);

  const isLoading = useMemo(() => {
    return isLoadingToolMetaData || isLoadingCustomTools;
  }, [isLoadingToolMetaData, isLoadingCustomTools]);

  const customToolsList = useMemo(() => {
    if (!customTools) {
      return [];
    }

    return customTools
      .filter((tool) => {
        const provider = findProviderFromTags(tool);

        return provider === 'custom';
      })
      .filter((tool) => {
        if (!search) {
          return true;
        }

        return tool.name?.toLowerCase().includes(search.toLowerCase());
      })
      .map((tool) => ({
        name: tool.name || '',
        description: tool.description || '',
        id: tool.id || '',
        brand: 'custom',
        provider: 'custom',
        imageUrl: null,
      }));
  }, [customTools, search]);

  const tools: ToolMetadataPreviewType[] = useMemo(() => {
    if (category === 'custom') {
      return customToolsList;
    }

    const categoryTools =
      toolMetaData?.pages.flatMap((page) => page.body.toolMetadata) || [];

    if (category === 'all') {
      return [...customToolsList, ...categoryTools];
    }

    return categoryTools;
  }, [category, customToolsList, toolMetaData?.pages]);

  const t = useTranslations('ADE/Tools');

  return (
    <VStack overflow="hidden" gap="large" fullHeight fullWidth>
      <HStack paddingX align="center" justify="spaceBetween">
        <VStack>
          <RawInput
            hideLabel
            preIcon={<SearchIcon />}
            placeholder={t('ViewCategoryTools.search.placeholder')}
            label={t('ViewCategoryTools.search.label')}
            fullWidth
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
        </VStack>
        <Button
          label={t('ViewCategoryTools.create')}
          color="secondary"
          onClick={() => {
            startCreateTool();
          }}
        />
      </HStack>
      <VStack paddingX overflowY="auto">
        {!isLoading ? (
          <VStack>
            <NiceGridDisplay>
              {tools.map((tool) => (
                <ActionCard
                  key={tool.id}
                  title={tool.name}
                  subtitle={
                    isBrandKey(tool.brand)
                      ? brandKeyToName(tool.brand)
                      : tool.brand
                  }
                  icon={
                    tool.imageUrl ? (
                      <img src={tool.imageUrl} alt="" />
                    ) : (
                      <ToolsIcon />
                    )
                  }
                  mainAction={
                    <Button
                      color="tertiary"
                      label={t('ViewCategoryTools.view')}
                      onClick={() => {
                        setCurrentTool(tool);
                      }}
                    />
                  }
                >
                  {/* eslint-disable-next-line react/forbid-component-props */}
                  <Typography className="line-clamp-3">
                    {tool.description}
                  </Typography>
                </ActionCard>
              ))}
            </NiceGridDisplay>
            {hasNextPage && (
              <Button
                fullWidth
                color="tertiary"
                label={t('ViewCategoryTools.loadMore')}
                onClick={() => {
                  void fetchNextPage();
                }}
              />
            )}
          </VStack>
        ) : (
          <LoadingEmptyStatusComponent emptyMessage="" isLoading />
        )}
      </VStack>
    </VStack>
  );
}

interface ToolAppHeaderProps {
  children: React.ReactNode;
  borderBottom?: boolean;
}

function ToolAppHeader(props: ToolAppHeaderProps) {
  const { children, borderBottom } = props;
  return (
    <HStack
      height="header"
      borderBottom={borderBottom}
      align="center"
      justify="spaceBetween"
      paddingX
      fullWidth
    >
      <HStack gap={false}>{children}</HStack>
      <CloseMiniApp>
        <CloseIcon />
      </CloseMiniApp>
    </HStack>
  );
}

function getCustomTools(tools: letta__schemas__tool__Tool[]) {
  return tools.filter((tool) => {
    const provider = findProviderFromTags(tool);

    return provider === 'custom';
  });
}

function AllToolsView() {
  const { currentTool, clearCurrentTool } = useToolsExplorerState();

  const {
    isLoading: isLoadingShowComposioTools,
    data: isShowComposioToolsEnabled,
  } = useFeatureFlag('SHOW_COMPOSIO_TOOLS');

  const shouldShowComposioTools = useMemo(() => {
    return !isLoadingShowComposioTools && isShowComposioToolsEnabled;
  }, [isLoadingShowComposioTools, isShowComposioToolsEnabled]);

  const { data: summary } = webApi.toolMetadata.getToolMetadataSummary.useQuery(
    {
      queryKey: webApiQueryKeys.toolMetadata.getToolMetadataSummary,
      enabled: shouldShowComposioTools,
    }
  );

  const { data: groupMetaData } =
    webApi.toolMetadata.listToolGroupMetadata.useQuery({
      queryKey: webApiQueryKeys.toolMetadata.listToolMetadataWithSearch({
        limit: 200,
      }),
      queryData: {
        query: {
          limit: 200,
        },
      },
      enabled: shouldShowComposioTools,
    });

  const [category, setCategory] = useState<ToolViewerCategory>('all');

  const t = useTranslations('ADE/Tools');

  const [categorySearch, setCategorySearch] = useState('');

  const content = useMemo(() => {
    if (isCurrentToolInViewOrEdit(currentTool) && currentTool?.data) {
      return <ViewTool showAddToolToAgent tool={currentTool.data} />;
    }

    return <ViewCategoryTools category={category} />;
  }, [category, currentTool]);

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
      });
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

  const handleSelectCategory = useCallback(
    (category: ToolViewerCategory) => {
      setCategory(category);
      clearCurrentTool();
    },
    [clearCurrentTool]
  );

  const { data: customTools, isLoading: isLoadingCustomTools } =
    useToolsServiceListTools({
      limit: 100,
    });

  const customToolCount = useMemo(() => {
    if (isLoadingCustomTools) {
      return '-';
    }

    if (!customTools) {
      return 0;
    }

    return getCustomTools(customTools).length;
  }, [customTools, isLoadingCustomTools]);

  const allToolsCount = useMemo(() => {
    let count = '-';

    if (shouldShowComposioTools) {
      if (typeof customToolCount === 'number' && summary?.body) {
        count = `${customToolCount + summary.body.allToolsCount}`;
      }
    } else {
      if (customTools) {
        count = `${customToolCount}`;
      }
    }

    return count;
  }, [customToolCount, customTools, shouldShowComposioTools, summary?.body]);

  return (
    <HStack fullHeight gap={false}>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="min-w-[350px] visibleSidebar:flex hidden" borderRight>
        <VStack
          gap="large"
          justify="center"
          padding
          paddingBottom="small"
          borderBottom
          fullWidth
        >
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
          {(shouldShowComposioTools && summary?.body) ||
          !shouldShowComposioTools ? (
            <>
              <ToolCategoryButton
                category="all"
                label={t('AllToolsView.categories.allTools', {
                  count: allToolsCount,
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
                .filter((brandIntegration) =>
                  brandIntegration.name
                    .toLowerCase()
                    .includes(categorySearch.toLowerCase())
                )
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
        <ToolAppHeader>
          {currentTool ? (
            <Button
              label={
                category === 'all'
                  ? t('AllToolsView.backToAllTools')
                  : t('AllToolsView.backToCategory', {
                      category: title,
                    })
              }
              color="tertiary-transparent"
              size="small"
              preIcon={<ChevronLeftIcon />}
              onClick={() => {
                clearCurrentTool();
              }}
            />
          ) : (
            <Typography bold>{title}</Typography>
          )}
        </ToolAppHeader>
        {content}
      </VStack>
    </HStack>
  );
}

export function findProviderFromTags(tool: letta__schemas__tool__Tool) {
  const tagsToMap = new Set(tool.tags || []);

  if (tagsToMap.has('composio')) {
    return 'composio';
  }

  if (tagsToMap.has('letta-base')) {
    return 'letta';
  }

  if (tagsToMap.has('memgpt-base')) {
    return 'letta';
  }

  return 'custom';
}

export function useToolsExplorerState() {
  const [explorerState, setExplorerState] = useAtom(toolsExplorerAtom);

  const isToolExplorerOpen = useMemo(() => {
    return explorerState.isOpen;
  }, [explorerState]);

  const openToolExplorer = useCallback(
    (state?: Partial<ToolsExplorerContextState>) => {
      setExplorerState({
        currentTool: state?.currentTool,
        isOpen: true,
      });
    },
    [setExplorerState]
  );

  const startCreateTool = useCallback(() => {
    setExplorerState({
      currentTool: { mode: 'create' },
      isOpen: true,
    });
  }, [setExplorerState]);

  const closeToolExplorer = useCallback(() => {
    setExplorerState({
      currentTool: undefined,
      isOpen: false,
    });
  }, [setExplorerState]);

  const switchToolState = useCallback(
    (mode: ToolViewerState) => {
      setExplorerState((prev) => {
        if (!prev.currentTool) {
          return prev;
        }

        if (!isCurrentToolInViewOrEdit(prev.currentTool)) {
          return prev;
        }

        return {
          ...prev,
          currentTool: {
            data: prev.currentTool.data,
            mode,
          },
        };
      });
    },
    [setExplorerState]
  );

  const setCurrentTool = useCallback(
    (tool: ToolMetadataPreviewType, mode: ToolViewerState = 'view') => {
      setExplorerState((prev) => {
        return {
          ...prev,
          currentTool: {
            data: tool,
            mode,
          },
        };
      });
    },
    [setExplorerState]
  );

  const clearCurrentTool = useCallback(() => {
    setExplorerState((prev) => {
      return {
        ...prev,
        currentTool: undefined,
      };
    });
  }, [setExplorerState]);

  return {
    currentTool: explorerState.currentTool,
    setCurrentTool,
    clearCurrentTool,
    isToolExplorerOpen,
    switchToolState,
    openToolExplorer,
    startCreateTool,
    closeToolExplorer,
  };
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

  const { outputValue, outputStdout, outputStderr, outputStatus } =
    useMemo(() => {
      if (data) {
        const hiddenValues = ['stdout', 'stderr'];
        return {
          outputValue: JSON.stringify(
            data,
            (k, v) => (hiddenValues.includes(k) ? undefined : v),
            2
          ),
          outputStdout: data.stdout?.join('\n') ?? '',
          outputStderr: data.stderr?.join('\n') ?? '',
          outputStatus:
            data.status === 'error' ? ('error' as const) : ('success' as const),
        };
      }

      return {
        outputValue: error ? JSON.stringify(error, null, 2) : null,
        outputStdout: '',
        outputStderr: '',
        outputStatus: error ? ('error' as const) : undefined,
      };
    }, [data, error]);

  return (
    <HStack flex overflow="hidden" fullWidth>
      <RawCodeEditor
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
                  stdout: outputStdout,
                  stderr: outputStderr,
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

function inferNameFromPythonCode(code: string) {
  const nameRegex = /def\s+(\w+)\s*\(/;
  const match = nameRegex.exec(code);

  return match ? match[1] : '';
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

function ToolCreator() {
  const t = useTranslations('ADE/Tools');
  const { clearCurrentTool, setCurrentTool } = useToolsExplorerState();

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
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: UseToolsServiceListToolsKeyFn(),
      });

      setCurrentTool(
        {
          id: data.id || '',
          name: data.name || '',
          description: data.description || '',
          brand: 'custom',
          provider: 'custom',
          imageUrl: null,
          providerId: '',
        },
        'view'
      );
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
    <VStack gap={false} flex collapseHeight paddingBottom>
      <ToolAppHeader borderBottom>
        <HStack>
          <Breadcrumb
            variant="body"
            items={[
              {
                preIcon: <ExploreIcon />,
                onClick: clearCurrentTool,
                label: t('EditToolWrapper.root'),
              },
              {
                label: t('ToolCreator.new'),
              },
            ]}
          />
        </HStack>
      </ToolAppHeader>
      {errorMessage && (
        <ErrorMessageAlert message={errorMessage} onDismiss={reset} />
      )}
      <VStack paddingTop="small" flex collapseHeight paddingX fullWidth>
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
                <CloseMiniApp>
                  <Button
                    type="button"
                    color="tertiary"
                    label={t('SpecificToolComponent.back')}
                  />
                </CloseMiniApp>
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

interface EditToolProps {
  tool: letta__schemas__tool__Tool;
}

function EditTool(props: EditToolProps) {
  const { tool } = props;

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [sourceCode, setSourceCode] = useState(tool.source_code || '');

  const { mutate, isPending, error } = useToolsServiceUpdateTool();

  const t = useTranslations('ADE/Tools');

  const handleUpdateCode = useCallback(() => {
    mutate(
      {
        toolId: tool.id || '',
        requestBody: {
          source_code: sourceCode,
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
                source_code: sourceCode,
              };
            }
          );

          setOpen(false);
        },
      }
    );
  }, [mutate, queryClient, sourceCode, tool.id]);

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
    <VStack collapseHeight paddingX paddingBottom flex gap="form">
      <ToolEditor code={sourceCode} onSetCode={setSourceCode} />

      <FormActions>
        <CloseMiniApp>
          <Button color="tertiary" label={t('EditTool.close')} />
        </CloseMiniApp>
        <Dialog
          title={t('EditTool.updateDialog.title')}
          onConfirm={handleUpdateCode}
          onOpenChange={setOpen}
          isOpen={open}
          errorMessage={errorMessage}
          isConfirmBusy={isPending}
          trigger={
            <Button
              type="button"
              label={t('EditTool.update')}
              color="secondary"
            />
          }
        >
          {t('EditTool.updateDialog.description')}
        </Dialog>
      </FormActions>
    </VStack>
  );
}

function EditToolWrapper() {
  const { currentTool, clearCurrentTool, switchToolState } =
    useToolsExplorerState();

  const toolId = useMemo(() => {
    if (isCurrentToolInViewOrEdit(currentTool)) {
      return currentTool?.data.id || '';
    }

    return '';
  }, [currentTool]);

  const toolName = useMemo(() => {
    if (!isCurrentToolInViewOrEdit(currentTool)) {
      return '';
    }

    return currentTool?.data.name || '';
  }, [currentTool]);

  const { data: tool } = useToolsServiceGetTool(
    {
      toolId,
    },
    undefined,
    {
      enabled: !!toolId,
    }
  );

  const t = useTranslations('ADE/Tools');

  return (
    <VStack fullHeight fullWidth>
      <ToolAppHeader borderBottom>
        <HStack>
          <Breadcrumb
            variant="body"
            items={[
              {
                preIcon: <ExploreIcon />,
                onClick: clearCurrentTool,
                label: t('EditToolWrapper.root'),
              },
              {
                onClick: () => {
                  switchToolState('view');
                },
                label: `${toolName}()`,
              },
              {
                label: t('EditToolWrapper.edit'),
              },
            ]}
          />
        </HStack>
      </ToolAppHeader>
      {!tool ? (
        <LoadingEmptyStatusComponent emptyMessage="" isLoading />
      ) : (
        <EditTool tool={tool} />
      )}
    </VStack>
  );
}

export function ToolsExplorer() {
  const t = useTranslations('ADE/Tools');
  const {
    isToolExplorerOpen,
    currentTool,
    closeToolExplorer,
    openToolExplorer,
  } = useToolsExplorerState();

  const [openConfirmLeave, setOpenConfirmLeave] = useState(false);

  const handleOpen = useCallback(
    (nextState: boolean, force?: boolean) => {
      if (!nextState) {
        if (!force) {
          if (currentTool?.mode === 'edit' || currentTool?.mode === 'create') {
            setOpenConfirmLeave(true);
            return;
          }
        }

        setOpenConfirmLeave(false);
        closeToolExplorer();
        return;
      }

      openToolExplorer();
    },
    [closeToolExplorer, currentTool?.mode, openToolExplorer]
  );

  const component = useMemo(() => {
    if (currentTool?.mode === 'create') {
      return <ToolCreator />;
    }

    if (currentTool?.mode === 'edit') {
      return <EditToolWrapper />;
    }

    return <AllToolsView />;
  }, [currentTool]);

  return (
    <MiniApp
      isOpen={isToolExplorerOpen}
      onOpenChange={handleOpen}
      appName="Tool Explorer"
    >
      <Dialog
        title={t('ToolsExplorer.confirmLeave.title')}
        isOpen={openConfirmLeave}
        onOpenChange={setOpenConfirmLeave}
        onConfirm={() => {
          handleOpen(false, true);
        }}
      >
        {t('ToolsExplorer.confirmLeave.description')}
      </Dialog>
      {component}
    </MiniApp>
  );
}
