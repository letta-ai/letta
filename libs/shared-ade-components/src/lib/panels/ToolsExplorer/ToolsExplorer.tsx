import type { ToolMetadataPreviewType } from '@letta-cloud/web-api-client';
import {
  COMPOSIO_KEY_NAME,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/web-api-client';
import type { HTMLProps } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../hooks';
import type { AgentState, Tool } from '@letta-cloud/letta-agents-api';
import {
  isAPIError,
  isLettaTool,
  type RetrieveToolResponse,
  useAgentsServiceAttachTool,
  UseAgentsServiceRetrieveAgentKeyFn,
  useToolsServiceAddComposioTool,
  useToolsServiceCreateTool,
  useToolsServiceDeleteTool,
  useToolsServiceListComposioApps,
  useToolsServiceListTools,
  UseToolsServiceListToolsKeyFn,
  useToolsServiceModifyTool,
  useToolsServiceRetrieveTool,
  UseToolsServiceRetrieveToolKeyFn,
  useToolsServiceRunToolFromSource,
} from '@letta-cloud/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionCard,
  Alert,
  brandKeyToLogo,
  brandKeyToName,
  Breadcrumb,
  Button,
  ChevronLeftIcon,
  CloseIcon,
  CloseMiniApp,
  Code,
  CodeBlocksIcon,
  CodeIcon,
  ComposioLockupDynamic,
  Debugger,
  Dialog,
  ExploreIcon,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HStack,
  InlineCode,
  isBrandKey,
  ListIcon,
  LoadedTypography,
  LoadingEmptyStatusComponent,
  Logo,
  MiniApp,
  NiceGridDisplay,
  PlusIcon,
  RawCodeEditor,
  RawInput,
  SearchIcon,
  Section,
  TabGroup,
  TerminalIcon,
  toast,
  ToolsIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import { atom, useAtom } from 'jotai';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useDebouncedValue } from '@mantine/hooks';
import { get } from 'lodash-es';
import { Slot } from '@radix-ui/react-slot';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/rbac';

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
  state: ToolsExplorerContextState['currentTool'],
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
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  image?: React.ReactNode | string;
  selectedCategory: ToolViewerCategory;
  setSelectedCategory: (category: ToolViewerCategory) => void;
}

function ToolCategoryButton(props: ToolCategoryButtonProps) {
  const t = useTranslations('ADE/Tools');
  const { category, image, label, selectedCategory, setSelectedCategory } =
    props;

  const preIcon = useMemo(() => {
    if (typeof image === 'string') {
      return <img src={image} alt="" />;
    }

    if (image) {
      return image;
    }

    if (label.includes(t('AllToolsView.titles.customTools'))) {
      return <CodeBlocksIcon />;
    }

    return <ToolsIcon />;
  }, [image, label, t]);

  return (
    <Button
      label={label}
      preIcon={preIcon}
      color="tertiary"
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

  const hasPreviewAbleProvider = useMemo(() => {
    return ['letta', 'custom'].includes(provider);
  }, [provider]);

  const { data: tool } = useToolsServiceRetrieveTool(
    {
      toolId,
    },
    undefined,
    {
      enabled: hasPreviewAbleProvider,
    },
  );

  const toolCode = useMemo(() => {
    if (hasPreviewAbleProvider) {
      return tool?.source_code || '';
    }

    return t('SpecificToolComponent.codePreviewUnavailableForComposio');
  }, [hasPreviewAbleProvider, tool, t]);

  const toolSchema = useMemo(() => {
    if (hasPreviewAbleProvider) {
      return tool?.json_schema ? JSON.stringify(tool.json_schema, null, 2) : '';
    }

    return t('SpecificToolComponent.jsonPreviewUnavailableForComposio');
  }, [hasPreviewAbleProvider, t, tool?.json_schema]);

  return (
    <div className="min-h-[400px] w-full flex-1 flex flex-col">
      <VStack flex collapseHeight>
        <TabGroup
          value={viewMode}
          onValueChange={(mode) => {
            if (mode) {
              setViewMode(mode as ViewMode);
            }
          }}
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
              code={toolCode}
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
              code={toolSchema}
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
      color="secondary"
    />
  );
}

function useIsComposioConnected() {
  const { isLocal } = useCurrentAgentMetaData();

  const { data: keyExistence, isLoading: isLoadingKey } =
    webApi.environmentVariables.getEnvironmentVariableByKey.useQuery({
      queryKey:
        webApiQueryKeys.environmentVariables.getEnvironmentVariableByKey(
          COMPOSIO_KEY_NAME,
        ),
      queryData: {
        params: {
          key: COMPOSIO_KEY_NAME,
        },
      },
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      enabled: !isLocal,
    });

  const { data: isLocalComposioConnected, isLoading: isLoadingLocal } =
    useToolsServiceListComposioApps({}, undefined, {
      enabled: isLocal,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
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

  const { mutateAsync: attachToolToAgent } = useAgentsServiceAttachTool({
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

      const response = await attachToolToAgent({
        agentId,
        toolId: toolIdToAdd,
      });

      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tools: response.tools,
          };
        },
      );
    } catch (e) {
      let errorMessage = t('AddToolToAgentButton.error');
      const errorCode = get(e, 'body.detail.code') || '';

      if (errorCode) {
        switch (errorCode) {
          case 'ComposioSDKError': {
            errorMessage = t(
              'AddToolToAgentButton.errors.composio.ComposioSDKError',
            );
            break;
          }

          case 'ApiKeyNotProvidedError': {
            errorMessage = t(
              'AddToolToAgentButton.errors.composio.ApiKeyNotProvidedError',
            );
            break;
          }

          default: {
            errorMessage = t('AddToolToAgentButton.error');
            break;
          }
        }
      }

      toast.error(errorMessage);
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
    tool.id,
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

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const disableAttach = useMemo(() => {
    if (!canUpdateAgent) {
      return true;
    }

    if (isComposioTool) {
      return !isComposioConnected;
    }

    return isToolInAgent;
  }, [isComposioConnected, isComposioTool, isToolInAgent, canUpdateAgent]);

  if (isToolInAgent) {
    return (
      <Button
        size="small"
        label={t('AddToolToAgentButton.alreadyAdded')}
        color="secondary"
        disabled
      />
    );
  }

  return (
    <Button
      size="small"
      preIcon={<PlusIcon />}
      busy={isPending}
      data-testid="attach-tool-to-agent"
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

  const { data: localTool } = useToolsServiceRetrieveTool(
    {
      toolId: baseTool.id,
    },
    undefined,
    {
      enabled: isCustomOrLettaProvider,
    },
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

  const toolMetaDataSearchResult = useMemo(() => {
    return toolMetaData?.body.toolMetadata[0];
  }, [toolMetaData?.body.toolMetadata]);

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

    return {
      name: toolMetaDataSearchResult?.name || baseTool.name || '',
      description:
        toolMetaDataSearchResult?.description || baseTool.description || '',
      id: toolMetaDataSearchResult?.id || baseTool.id || '',
      brand: toolMetaDataSearchResult?.brand || baseTool.brand || 'custom',
      provider: toolMetaDataSearchResult?.provider || baseTool.provider,
      imageUrl: toolMetaDataSearchResult?.imageUrl || baseTool.provider,
      providerId: toolMetaDataSearchResult?.providerId || baseTool.providerId,
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
    toolMetaDataSearchResult,
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

  const composioViewUrl = useMemo(() => {
    if (!toolMetaDataSearchResult) {
      return '';
    }

    if (toolMetaDataSearchResult.configuration?.type !== 'composio') {
      return '';
    }

    return `https://app.composio.dev/app/${toolMetaDataSearchResult.configuration.appId}`;
  }, [toolMetaDataSearchResult]);

  const showComposioSetupBanner = useMemo(() => {
    if (isComposioConnectedLoading) {
      return false;
    }

    return isComposioTool && !isComposioConnected;
  }, [isComposioConnected, isComposioConnectedLoading, isComposioTool]);
  const [canUpdateTool] = useADEPermissions(ApplicationServices.UPDATE_TOOL);

  return (
    <VStack overflowY="auto" paddingX paddingBottom fullHeight flex>
      <VStack fullHeight gap="large" paddingBottom fullWidth>
        <HStack borderBottom paddingBottom fullWidth align="center">
          <div className="w-[100px] p-5">
            <Slot
              /* eslint-disable-next-line react/forbid-component-props */
              className="w-full"
            >
              <ToolIconRender
                imageUrl={tool.imageUrl || ''}
                brand={tool.brand}
              />
            </Slot>
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
                      <ComposioLockupDynamic width={80} />
                    </div>
                  </>
                )}
              </HStack>
            </VStack>
            <HStack>
              {showAddToolToAgent && <AddToolToAgentButton tool={tool} />}
              {canUpdateTool && isEditable && <EditToolButton />}
              {composioViewUrl && (
                <Button
                  target="_blank"
                  size="small"
                  href={composioViewUrl}
                  label={t('ViewTool.viewOnComposio')}
                  color="secondary"
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
                    code: () => <InlineCode code={COMPOSIO_KEY_NAME} />,
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
                    color="primary"
                  />
                </HStack>
              )}
            </VStack>
          </Alert>
        )}
        <VStack width="largeContained" fullWidth>
          <Section title={t('SpecificToolComponent.description')}>
            <Typography fullWidth variant="body" italic={!tool?.description}>
              {toolDescription?.replace(/\n|\t/g, ' ').trim()}
            </Typography>
          </Section>
        </VStack>
        <ViewToolCodePreview toolId={tool.id} provider={tool.provider} />
      </VStack>
    </VStack>
  );
}

interface ToolIconRenderProps extends HTMLProps<any> {
  imageUrl?: string;
  brand: string;
}

function ToolIconRender(props: ToolIconRenderProps) {
  const { imageUrl, brand, ...rest } = props;

  if (isBrandKey(brand) && brandKeyToLogo(brand)) {
    return <Slot {...rest}>{brandKeyToLogo(brand)}</Slot>;
  }

  if (imageUrl) {
    return (
      <Slot {...rest}>
        <img src={imageUrl} alt="" />
      </Slot>
    );
  }

  return (
    <Slot {...rest}>
      <ToolsIcon />
    </Slot>
  );
}

interface ToolActionCardProps {
  tool: ToolMetadataPreviewType;
  setCurrentTool: () => void;
}

function ToolActionCard(props: ToolActionCardProps) {
  const { tool, setCurrentTool } = props;

  return (
    <ActionCard
      key={tool.id}
      title={tool.name}
      subtitle={
        isBrandKey(tool.brand) ? brandKeyToName(tool.brand) : tool.brand
      }
      icon={
        <Slot className="w-[25px]">
          <ToolIconRender imageUrl={tool.imageUrl || ''} brand={tool.brand} />
        </Slot>
      }
      hideClickArrow
      onClick={() => {
        setCurrentTool();
      }}
    >
      {/* eslint-disable-next-line react/forbid-component-props */}
      <Typography align="left" className="line-clamp-3">
        {tool.description}
      </Typography>
    </ActionCard>
  );
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type ToolViewerCategory = string | 'all' | 'custom' | 'letta';

interface ViewCategoryToolsProps {
  category: ToolViewerCategory;
}

const PAGE_SIZE = 100;

function ViewCategoryTools(props: ViewCategoryToolsProps) {
  const { category } = props;

  const { setCurrentTool, startCreateTool } = useToolsExplorerState();
  const [search, setSearch] = useState<string>('');

  const [debouncedSearch] = useDebouncedValue(search, 200);
  const query = useMemo(
    () => ({
      brand: ['all', 'custom', 'letta'].includes(category)
        ? undefined
        : category,
      search: debouncedSearch,
    }),
    [category, debouncedSearch],
  );

  const usesToolMetadata = useMemo(() => {
    return !['custom', 'letta'].includes(category);
  }, [category]);

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
    enabled: usesToolMetadata,
  });

  const { data: customTools, isLoading: isLoadingCustomTools } =
    useToolsServiceListTools(
      {
        limit: 1000,
      },
      undefined,
      {
        enabled: ['all', 'custom', 'letta'].includes(category),
      },
    );

  const hasNextPage = useMemo(() => {
    return !usesToolMetadata ? false : hasNextToolMetaData;
  }, [usesToolMetadata, hasNextToolMetaData]);

  const isLoading = useMemo(() => {
    return isLoadingToolMetaData || isLoadingCustomTools;
  }, [isLoadingToolMetaData, isLoadingCustomTools]);

  const nonMetatdataTools = useMemo(() => {
    if (!customTools) {
      return [];
    }

    return customTools
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
        brand: findProviderFromTags(tool),
        provider: findProviderFromTags(tool),
        imageUrl: null,
      }));
  }, [customTools, search]);

  const tools: ToolMetadataPreviewType[] = useMemo(() => {
    if (category === 'custom') {
      return nonMetatdataTools.filter((tool) => {
        return tool.provider === 'custom';
      });
    }

    if (category === 'letta') {
      return nonMetatdataTools.filter((tool) => {
        return tool.provider === 'letta';
      });
    }

    const categoryTools =
      toolMetaData?.pages.flatMap((page) => page.body.toolMetadata) || [];

    if (category === 'all') {
      return [...nonMetatdataTools, ...categoryTools];
    }

    return categoryTools;
  }, [category, nonMetatdataTools, toolMetaData?.pages]);

  const t = useTranslations('ADE/Tools');

  const [canCreateTool] = useADEPermissions(ApplicationServices.CREATE_TOOL);

  return (
    <VStack overflow="hidden" gap="large" fullHeight fullWidth>
      <HStack
        paddingTop="xxsmall"
        paddingX
        align="center"
        justify="spaceBetween"
      >
        <VStack fullWidth>
          <RawInput
            width="large"
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
        {canCreateTool && (
          <Button
            label={t('ViewCategoryTools.create')}
            color="primary"
            data-testid="start-create-tool"
            onClick={() => {
              startCreateTool();
            }}
          />
        )}
      </HStack>
      <VStack paddingX overflowY="auto">
        {!isLoading ? (
          <VStack>
            <NiceGridDisplay>
              {tools.map((tool) => (
                <ToolActionCard
                  key={tool.id}
                  tool={tool}
                  setCurrentTool={() => {
                    setCurrentTool(tool);
                  }}
                />
              ))}
            </NiceGridDisplay>
            {hasNextPage && (
              <Button
                fullWidth
                color="secondary"
                label={t('ViewCategoryTools.loadMore')}
                onClick={() => {
                  void fetchNextPage();
                }}
              />
            )}
            <VStack paddingBottom fullWidth />
          </VStack>
        ) : (
          <LoadingEmptyStatusComponent
            hideText
            loaderVariant="grower"
            emptyMessage=""
            isLoading
          />
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
      <CloseMiniApp data-testid="close-tool-explorer">
        <HStack>
          <CloseIcon />
        </HStack>
      </CloseMiniApp>
    </HStack>
  );
}

function getCustomTools(tools: Tool[]) {
  return tools.filter((tool) => {
    const provider = findProviderFromTags(tool);

    return provider === 'custom';
  });
}

function getLettaTools(tools: Tool[]) {
  return tools.filter((tool) => {
    const provider = findProviderFromTags(tool);

    return provider === 'letta';
  });
}

function AllToolsView() {
  const { currentTool, clearCurrentTool } = useToolsExplorerState();

  const { data: summary } = webApi.toolMetadata.getToolMetadataSummary.useQuery(
    {
      queryKey: webApiQueryKeys.toolMetadata.getToolMetadataSummary,
    },
  );

  const { data: groupMetaData } =
    webApi.toolMetadata.listToolGroupMetadata.useQuery({
      queryKey: webApiQueryKeys.toolMetadata.listToolMetadataWithSearch({
        limit: 400,
      }),
      queryData: {
        query: {
          limit: 400,
        },
      },
    });

  const [category, setCategory] = useState<ToolViewerCategory>('all');

  const t = useTranslations('ADE/Tools');

  const content = useMemo(() => {
    if (isCurrentToolInViewOrEdit(currentTool) && currentTool?.data) {
      return <ViewTool showAddToolToAgent tool={currentTool.data} />;
    }

    return <ViewCategoryTools category={category} />;
  }, [category, currentTool]);

  const brandIntegrations = useMemo(() => {
    return (groupMetaData?.body.toolGroups || [])
      .filter(({ toolCount }) => toolCount > 0)
      .map(({ brand, toolCount, imageUrl }) => {
        return {
          name: isBrandKey(brand) ? brandKeyToName(brand) : `${brand} (Beta)`,
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

    if (category === 'letta') {
      return t('AllToolsView.titles.lettaTools');
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
    [clearCurrentTool],
  );

  const { data: customTools, isLoading: isLoadingCustomTools } =
    useToolsServiceListTools({
      limit: 1000,
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

  const lettaToolCount = useMemo(() => {
    if (isLoadingCustomTools) {
      return '-';
    }

    if (!customTools) {
      return 0;
    }

    return getLettaTools(customTools).length;
  }, [customTools, isLoadingCustomTools]);

  const allToolsCount = useMemo(() => {
    let count = '-';

    if (typeof customToolCount === 'number' && summary?.body) {
      count = `${customToolCount + summary.body.allToolsCount}`;
    }

    return count;
  }, [customToolCount, summary?.body]);

  return (
    <HStack fullHeight gap={false}>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="min-w-[350px] visibleSidebar:flex hidden" borderRight>
        <VStack
          gap="large"
          justify="center"
          padding
          paddingBottom="small"
          fullWidth
        >
          <HStack align="center" gap="medium">
            <ExploreIcon size="large" />
            <Typography align="left" variant="heading4">
              {t('AllToolsView.title')}
            </Typography>
          </HStack>
        </VStack>

        <VStack overflowY="auto" paddingX="small" gap="small">
          {summary?.body ? (
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
              <ToolCategoryButton
                category="letta"
                image={<Logo size="small" />}
                selectedCategory={category}
                label={t('AllToolsView.categories.lettaTools', {
                  count: lettaToolCount,
                })}
                setSelectedCategory={handleSelectCategory}
              />
              {brandIntegrations.map((brandIntegration) => (
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
            <LoadingEmptyStatusComponent
              hideText
              loaderVariant="grower"
              emptyMessage=""
              isLoading
            />
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
              color="tertiary"
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

export function findProviderFromTags(tool: Tool) {
  const tagsToMap = new Set(tool.tags || []);

  if (tagsToMap.has('composio')) {
    return 'composio';
  }

  if (isLettaTool(tool)) {
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
    [setExplorerState],
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
    [setExplorerState],
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
    [setExplorerState],
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

interface EditableToolSettings {
  returnCharLimit: number;
}

function DeleteToolButton() {
  const { currentTool, clearCurrentTool } = useToolsExplorerState();
  const t = useTranslations('ADE/Tools');

  const [isOpened, setIsOpened] = useState(false);

  const {
    mutate: deleteTool,
    isError,
    isPending,
  } = useToolsServiceDeleteTool();

  const handleDelete = useCallback(() => {
    if (currentTool?.mode !== 'edit') {
      return;
    }

    deleteTool(
      {
        toolId: currentTool.data.id,
      },
      {
        onSuccess: () => {
          clearCurrentTool();
          window.location.reload();
        },
      },
    );
  }, [clearCurrentTool, currentTool, deleteTool]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      isOpen={isOpened}
      confirmColor="destructive"
      onOpenChange={setIsOpened}
      errorMessage={isError ? t('DeleteToolButton.error') : undefined}
      title={t('DeleteToolButton.title')}
      confirmText={t('DeleteToolButton.confirm')}
      onConfirm={handleDelete}
      trigger={
        <Button color="destructive" label={t('DeleteToolButton.trigger')} />
      }
    >
      {t('DeleteToolButton.description')}
    </Dialog>
  );
}

interface ToolSettingsProps {
  toolId?: string;
  onUpdateSettings: (settings: EditableToolSettings) => void;
  toolSettings: EditableToolSettings;
}

function ToolSettings(props: ToolSettingsProps) {
  const { toolId, onUpdateSettings, toolSettings } = props;
  const t = useTranslations('ADE/Tools');

  return (
    <VStack overflowY="auto" padding border fullHeight>
      <Section
        title={t('ToolSettings.title')}
        description={t('ToolSettings.description')}
      >
        <RawInput
          label={t('ToolSettings.returnCharLimit.label')}
          description={t('ToolSettings.returnCharLimit.description')}
          type="number"
          placeholder={t('ToolSettings.returnCharLimit.placeholder')}
          fullWidth
          value={toolSettings.returnCharLimit}
          onChange={(e) => {
            onUpdateSettings({
              ...toolSettings,
              returnCharLimit: parseInt(e.target.value, 10),
            });
          }}
        />
      </Section>
      {toolId && (
        <Section
          title={t('ToolSettings.deleteTool.title')}
          description={t('ToolSettings.deleteTool.description')}
        >
          <HStack>
            <DeleteToolButton />
          </HStack>
        </Section>
      )}
    </VStack>
  );
}

interface ToolEditorProps extends ToolSettingsProps {
  code: string;
  onSetCode: (code: string) => void;
}

type ToolEditorEditModes = 'settings' | 'source-code';

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
    [t],
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
            args: input,
            source_code: code,
          },
        },
        {
          onSuccess: () => {
            setCompletedAt(Date.now());
          },
        },
      );
    },
    [code, extractedFunctionName, inputConfig, mutate, reset],
  );

  const { outputValue, outputStdout, outputStderr, outputStatus } =
    useMemo(() => {
      if (data) {
        const { stdout, stderr, ...outputValue } = data;
        return {
          outputValue: JSON.stringify(outputValue.tool_return, null, 2), // stringify ensures that the output won't be highlighted
          outputStdout: stdout?.join('\n') ?? '',
          outputStderr: stderr?.join('\n') ?? '',
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

  const [mode, setMode] = useState<ToolEditorEditModes>('source-code');

  return (
    <HStack gap="small" flex overflow="hidden" fullWidth>
      <VStack overflow="hidden" fullWidth fullHeight gap={false}>
        <TabGroup
          variant="bordered-background"
          onValueChange={(value) => {
            setMode(value as ToolEditorEditModes);
          }}
          value={mode}
          items={[
            {
              icon: <CodeIcon />,
              label: t('ToolEditor.sourceCode.label'),
              value: 'source-code',
            },
            {
              label: t('ToolEditor.settings.label'),
              value: 'settings',
            },
          ]}
        />
        {mode === 'source-code' ? (
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
            hideLabel
            label={t('ToolCreator.sourceCode.label')}
          />
        ) : (
          <ToolSettings
            toolSettings={props.toolSettings}
            onUpdateSettings={props.onUpdateSettings}
            toolId={props.toolId}
          />
        )}
      </VStack>
      <HiddenOnMobile>
        <VStack overflow="hidden" gap={false} fullWidth fullHeight>
          <TabGroup
            variant="bordered-background"
            value="run"
            items={[
              {
                label: t('ToolEditor.label'),
                value: 'run',
                icon: <TerminalIcon />,
              },
            ]}
          />
          <Debugger
            hideLabel
            preLabelIcon={<TerminalIcon />}
            isRunning={isPending}
            onRun={handleRun}
            output={{
              status: outputStatus,
              duration: completedAt ? completedAt - submittedAt : undefined,
              responses: [
                {
                  label: t('ToolEditor.outputLabel'),
                  value: 'tool-output',
                  content: outputValue ?? '',
                },
                {
                  label: 'stdout',
                  value: 'stdout',
                  content: outputStdout,
                },
                {
                  label: 'stderr',
                  value: 'stderr',
                  content: outputStderr,
                },
              ],
            }}
            inputConfig={inputConfig}
            label={t('ToolEditor.label')}
          />
        </VStack>
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
    onSuccess: (data) => {
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
        'view',
      );

      void queryClient.setQueriesData<Tool[] | undefined>(
        {
          queryKey: UseToolsServiceListToolsKeyFn({ limit: 1000 }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return [...oldData, data];
        },
      );
    },
  });

  const [settings, setSettings] = useState<EditableToolSettings>({
    returnCharLimit: 6000,
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
          return_char_limit: settings.returnCharLimit,
          description: '',
          source_code: values.sourceCode,
        },
      });
    },
    [mutate, settings],
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
                  <ToolEditor
                    toolSettings={settings}
                    onUpdateSettings={setSettings}
                    code={field.value}
                    onSetCode={field.onChange}
                  />
                )}
              />
              <FormActions>
                <CloseMiniApp asChild>
                  <Button
                    type="button"
                    color="secondary"
                    label={t('SpecificToolComponent.back')}
                  />
                </CloseMiniApp>
                <Button
                  type="submit"
                  label="Create"
                  data-testid="submit-create-tool"
                  color="primary"
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
  tool: Tool;
}

function EditTool(props: EditToolProps) {
  const { tool } = props;

  const [confirmUpdateTool, setConfirmUpdateTool] = useState(false);
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<EditableToolSettings>({
    returnCharLimit: tool.return_char_limit || 1000,
  });

  const { switchToolState } = useToolsExplorerState();

  const [sourceCode, setSourceCode] = useState(tool.source_code || '');

  const [localError, setLocalError] = useState<string | null>(null);
  const { mutate, isPending, reset, error } = useToolsServiceModifyTool();

  const t = useTranslations('ADE/Tools');

  const handleConfirmUpdateToolVisibility = useCallback(
    (visibility: boolean) => {
      if (!visibility) {
        reset();
      }

      setConfirmUpdateTool(visibility);
    },
    [reset],
  );

  const handleUpdateCode = useCallback(() => {
    setLocalError(null);

    if (z.number().positive().safeParse(settings.returnCharLimit).error) {
      setLocalError(t('ToolSettings.returnCharLimit.error'));
      return;
    }

    mutate(
      {
        toolId: tool.id || '',
        requestBody: {
          source_code: sourceCode,
          return_char_limit: settings.returnCharLimit,
        },
      },
      {
        onError: () => {
          setConfirmUpdateTool(false);
        },
        onSuccess: () => {
          queryClient.setQueriesData<RetrieveToolResponse | undefined>(
            {
              queryKey: UseToolsServiceRetrieveToolKeyFn({
                toolId: tool.id || '',
              }),
            },
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                return_char_limit: settings.returnCharLimit,
                source_code: sourceCode,
              };
            },
          );

          switchToolState('view');
          handleConfirmUpdateToolVisibility(false);
        },
      },
    );
  }, [
    mutate,
    queryClient,
    t,
    switchToolState,
    handleConfirmUpdateToolVisibility,
    settings.returnCharLimit,
    sourceCode,
    tool.id,
  ]);

  const errorMessage = useMemo(() => {
    if (localError) {
      return localError;
    }

    if (!error) {
      return '';
    }

    let message: unknown = '';

    if (isAxiosError(error)) {
      message = error.response?.data;
    }

    return JSON.stringify(message || error, null, 2);
  }, [error, localError]);

  console.log(errorMessage);

  return (
    <VStack collapseHeight paddingX paddingBottom flex gap="form">
      {errorMessage && (
        <ErrorMessageAlert
          message={errorMessage}
          onDismiss={() => {
            setLocalError(null);
            reset();
          }}
        />
      )}
      <ToolEditor
        toolSettings={settings}
        onUpdateSettings={setSettings}
        toolId={tool.id}
        code={sourceCode}
        onSetCode={setSourceCode}
      />

      <FormActions>
        <CloseMiniApp asChild>
          <Button color="secondary" label={t('EditTool.close')} />
        </CloseMiniApp>
        <Dialog
          title={t('EditTool.updateDialog.title')}
          onConfirm={handleUpdateCode}
          onOpenChange={(open) => {
            if (!open) {
              setLocalError(null);
            }

            setConfirmUpdateTool(open);
          }}
          isOpen={confirmUpdateTool}
          isConfirmBusy={isPending}
          trigger={
            <Button
              type="button"
              label={t('EditTool.update')}
              color="primary"
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

  const { data: tool } = useToolsServiceRetrieveTool(
    {
      toolId,
    },
    undefined,
    {
      enabled: !!toolId,
    },
  );

  const t = useTranslations('ADE/Tools');

  return (
    <VStack fullHeight fullWidth>
      <ToolAppHeader borderBottom>
        <HStack>
          <Breadcrumb
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
                label: `${
                  toolName || tool?.name || t('EditToolWrapper.unnamed')
                }()`,
              },
              {
                label: t('EditToolWrapper.edit'),
              },
            ]}
          />
        </HStack>
      </ToolAppHeader>
      {!tool ? (
        <LoadingEmptyStatusComponent
          hideText
          loaderVariant="grower"
          emptyMessage=""
          isLoading
        />
      ) : (
        <EditTool tool={tool} />
      )}
    </VStack>
  );
}

export function ToolsExplorer() {
  const t = useTranslations('ADE/Tools');

  // preload
  useIsComposioConnected();
  webApi.toolMetadata.getToolMetadataSummary.useQuery({
    queryKey: webApiQueryKeys.toolMetadata.getToolMetadataSummary,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

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
    [closeToolExplorer, currentTool?.mode, openToolExplorer],
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
