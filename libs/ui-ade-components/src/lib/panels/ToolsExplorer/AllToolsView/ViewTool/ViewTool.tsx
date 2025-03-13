import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  type AgentState,
  useAgentsServiceAttachTool,
  UseAgentsServiceRetrieveAgentKeyFn,
  useToolsServiceAddComposioTool,
  useToolsServiceListComposioApps,
  useToolsServiceRetrieveTool,
} from '@letta-cloud/sdk-core';
import {
  Alert,
  brandKeyToName,
  Breadcrumb,
  Button,
  CodeIcon,
  ComposioLockupDynamic,
  HStack,
  InlineCode,
  isBrandKey,
  ListIcon,
  LoadedTypography,
  PlusIcon,
  RawCodeEditor,
  Section,
  TabGroup,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  type ToolExplorerCurrentToolState,
  useToolsExplorerState,
} from '../../useToolsExplorerState/useToolsExplorerState';
import { useCurrentAgentMetaData } from '../../../../hooks';
import {
  COMPOSIO_KEY_NAME,
  type ToolMetadataPreviewType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import { useCurrentAgent } from '../../../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { capitalize, get } from 'lodash-es';
import { useADEPermissions } from '../../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { Slot } from '@radix-ui/react-slot';
import { findProviderFromTags } from '../../findProviderFromTags/findProviderFromTags';
import { ToolIconRender } from '../../ToolIconRender/ToolIconRender';
import { ReturnToCategoryButton } from '../AllToolsViewHeader/AllToolsViewHeader';
import { ToolAppHeader } from '../../ToolAppHeader/ToolAppHeader';
import { useAllToolsViewState } from '../hooks/useAllToolsViewState/useAllToolsViewState';

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

export function useIsComposioConnected() {
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

interface ViewToolHeaderProps {
  tool: ToolExplorerCurrentToolState;
}

function ViewToolHeader(props: ViewToolHeaderProps) {
  const { tool } = props;

  const { clearCurrentTool } = useToolsExplorerState();
  const { category } = useAllToolsViewState();
  const showComposioBreadcrumb = useMemo(() => {
    return tool.provider === 'composio' && category === 'composio';
  }, [tool.provider, category]);

  return (
    <ToolAppHeader>
      <Breadcrumb
        size="small"
        items={[
          {
            label: 'root',
            contentOverride: (
              <ReturnToCategoryButton
                currentCategory={category}
                onReturn={() => {
                  clearCurrentTool();
                }}
              />
            ),
          },
          ...(showComposioBreadcrumb && tool.brand
            ? [
                {
                  preIcon: tool.imageUrl,
                  label: capitalize(tool.brand),
                  onClick: () => {
                    clearCurrentTool();
                  },
                },
              ]
            : []),
        ]}
      />
    </ToolAppHeader>
  );
}

interface ViewToolProps {
  tool: ToolExplorerCurrentToolState;
  showAddToolToAgent?: boolean;
}

export function ViewTool(props: ViewToolProps) {
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
    <VStack fullWidth fullHeight>
      <ViewToolHeader tool={tool} />
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
            <Alert
              variant="warning"
              title={t('ViewTool.connectComposio.title')}
            >
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
    </VStack>
  );
}
