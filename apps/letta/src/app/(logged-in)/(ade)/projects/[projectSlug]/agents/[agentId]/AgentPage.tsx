'use client';
import {
  panelRegistry,
  usePanelManager,
  RenderSinglePanel,
} from './panelRegistry';
import { PanelManagerProvider, PanelRenderer } from './panelRegistry';
import {
  ChevronDownIcon,
  EditIcon,
  HiddenOnMobile,
  MobileFooterNavigation,
  MobileFooterNavigationButton,
  LoadingEmptyStatusComponent,
} from '@letta-web/component-library';
import { Card, Checkbox, ExternalLink } from '@letta-web/component-library';
import { TrashIcon } from '@letta-web/component-library';
import {
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import { Badge } from '@letta-web/component-library';
import {
  CogIcon,
  DropdownMenu,
  DropdownMenuItem,
} from '@letta-web/component-library';
import { toast } from '@letta-web/component-library';
import { LayoutIcon } from '@letta-web/component-library';
import {
  ADEPage,
  Alert,
  Button,
  Dialog,
  Frame,
  HStack,
  LettaLoader,
  Popover,
  Typography,
  VisibleOnMobile,
  RocketIcon,
  ChevronUpIcon,
  ForkIcon,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useMemo, useState } from 'react';
import { useCurrentProject } from '../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$letta/client';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$letta/client/hooks';
import { ADEHeader } from '$letta/client/components';
import './AgentPage.scss';
import { useCurrentAgentMetaData } from './hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from './hooks';
import {
  useAgentsServiceGetAgent,
  UseAgentsServiceGetAgentKeyFn,
} from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { generateDefaultADELayout } from '$letta/utils';
import { isEqual } from 'lodash-es';
import { generateAgentStateHash } from './AgentSimulator/AgentSimulator';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteGetProjectDeployedAgentTemplates200Response } from '$letta/web-api/projects/projectContracts';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateNameDialog } from './shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import { useAgentBaseTypeName } from './hooks/useAgentBaseNameType/useAgentBaseNameType';
import { useLocalStorage } from '@mantine/hooks';
import { ErrorBoundary } from 'react-error-boundary';
import {
  DashboardHeaderNavigation,
  ProfilePopover,
} from '$letta/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigation';
import { CLOUD_UPSELL_URL } from '$letta/constants';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';

function RestoreLayoutButton() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { setPositions } = usePanelManager();

  const handleRestoreLayout = useCallback(() => {
    setPositions(generateDefaultADELayout().displayConfig);
  }, [setPositions]);

  return (
    <DropdownMenuItem
      preIcon={<LayoutIcon />}
      onClick={handleRestoreLayout}
      color="tertiary-transparent"
      label={t('restoreLayout')}
    />
  );
}

interface DeleteAgentDialogProps {
  onClose: () => void;
}

function DeleteAgentDialog(props: DeleteAgentDialogProps) {
  const { onClose } = props;
  const { name } = useCurrentAgent();

  const { slug: projectSlug } = useCurrentProject();
  const { id: agentTemplateId } = useCurrentAgent();
  const { isLocal } = useCurrentAgentMetaData();
  const user = useCurrentUser();

  const DeleteAgentDialogFormSchema = useMemo(
    () =>
      z.object({
        agentName: z.literal(name, {
          message: 'Agent name does not match',
        }),
      }),
    [name]
  );

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const form = useForm<z.infer<typeof DeleteAgentDialogFormSchema>>({
    resolver: zodResolver(DeleteAgentDialogFormSchema),
    defaultValues: {
      agentName: '',
    },
  });

  const { mutate, isPending, isSuccess, isError } =
    webOriginSDKApi.agents.deleteAgent.useMutation({
      onSuccess: () => {
        if (isLocal) {
          trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_DELETED, {
            userId: user?.id || '',
          });
        } else {
          trackClientSideEvent(AnalyticsEvent.CLOUD_AGENT_DELETED, {
            userId: user?.id || '',
          });
        }

        window.location.href = `/projects/${projectSlug}`;
      },
    });

  const agentBaseType = useAgentBaseTypeName();

  const handleSubmit = useCallback(() => {
    mutate({
      params: {
        agent_id: agentTemplateId,
      },
    });
  }, [mutate, agentTemplateId]);

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen
        onOpenChange={(next) => {
          if (!next) {
            onClose();
          }
        }}
        errorMessage={
          isError
            ? t('DeleteAgentDialog.error', {
                agentBaseType: agentBaseType.base,
              })
            : undefined
        }
        confirmColor="destructive"
        confirmText={t('DeleteAgentDialog.confirm', {
          agentBaseType: agentBaseType.capitalized,
        })}
        title={t('DeleteAgentDialog.title', {
          agentBaseType: agentBaseType.capitalized,
        })}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending || isSuccess}
      >
        <Typography>
          {t('DeleteAgentDialog.description', {
            agentBaseType: agentBaseType.base,
          })}
        </Typography>
        <Typography>
          {t.rich('DeleteAgentDialog.confirmText', {
            templateName: name,
            agentBaseType: agentBaseType.base,
            strong: (chunks) => <Typography bold>{chunks}</Typography>,
          })}
        </Typography>
        <FormField
          name="agentName"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('DeleteAgentDialog.confirmTextLabel', {
                agentBaseType: agentBaseType.capitalized,
              })}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

interface ForkAgentDialogProps {
  onClose: () => void;
}
function ForkAgentDialog(props: ForkAgentDialogProps) {
  const { onClose } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const agentBaseType = useAgentBaseTypeName();

  const { id: agentTemplateId } = useCurrentAgent();
  const { push } = useRouter();
  const { id: projectId, slug: projectSlug } = useCurrentProject();
  const { mutate, isPending, isSuccess } =
    webApi.agentTemplates.forkAgentTemplate.useMutation();

  const handleForkAgent = useCallback(() => {
    if (isPending || isSuccess) {
      return;
    }

    mutate(
      {
        params: {
          projectId,
          agentTemplateId: agentTemplateId,
        },
      },
      {
        onSuccess: (response) => {
          push(`/projects/${projectSlug}/templates/${response.body.name}`);
        },
      }
    );
  }, [
    agentTemplateId,
    isPending,
    isSuccess,
    mutate,
    projectId,
    projectSlug,
    push,
  ]);

  return (
    <Dialog
      isOpen
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      title={t('ForkAgentDialog.title', {
        agentBaseType: agentBaseType.capitalized,
      })}
      confirmText={t('ForkAgentDialog.confirm', {
        agentBaseType: agentBaseType.capitalized,
      })}
      onConfirm={handleForkAgent}
      isConfirmBusy={isPending || isSuccess}
    >
      {t('ForkAgentDialog.description', {
        agentBaseType: agentBaseType.base,
      })}
    </Dialog>
  );
}

interface LoaderContentProps {
  isError?: boolean;
}

function LoaderContent(props: LoaderContentProps) {
  const { isError } = props;

  return (
    <VStack
      /* eslint-disable-next-line react/forbid-component-props */
      className="fixed z-draggedItem top-0 left-0 w-[100vw] h-[100dvh]"
      fullHeight
      fullWidth
      align="center"
      justify="center"
    >
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="loader-content" align="center" gap="large">
        <LettaLoader size="large" />
        <Typography>Setting up your workspace...</Typography>
        {isError && (
          <Alert
            title="There was an error setting up your workspace - please contact support"
            variant="destructive"
          />
        )}
      </VStack>
    </VStack>
  );
}

const PAGE_SIZE = 10;

interface DeployAgentDialogProps {
  isAtLatestVersion: boolean;
}

function DeployAgentDialog(props: DeployAgentDialogProps) {
  const { isAtLatestVersion } = props;
  const { name } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  return (
    <Dialog
      title={t('DeployAgentDialog.title')}
      size="xlarge"
      trigger={
        <Button
          fullWidth
          data-testid="deploy-agent-dialog-trigger"
          color={!isAtLatestVersion ? 'tertiary-transparent' : 'secondary'}
          label={t('DeployAgentDialog.trigger')}
          target="_blank"
        />
      }
      hideConfirm
    >
      <DeployAgentUsageInstructions
        versionKey={`${name}:latest`}
        projectId={projectId}
      />
    </Dialog>
  );
}

const versionAgentFormSchema = z.object({
  migrate: z.boolean(),
});

type VersionAgentFormValues = z.infer<typeof versionAgentFormSchema>;

function VersionAgentDialog() {
  const { id: agentTemplateId } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const form = useForm<VersionAgentFormValues>({
    resolver: zodResolver(versionAgentFormSchema),
    defaultValues: {
      migrate: true,
    },
  });

  const { mutate, isPending } =
    webOriginSDKApi.agents.versionAgentTemplate.useMutation({
      onSuccess: (response) => {
        void queryClient.setQueriesData<
          InfiniteGetProjectDeployedAgentTemplates200Response | undefined
        >(
          {
            queryKey:
              webApiQueryKeys.projects.getProjectDeployedAgentTemplatesWithSearch(
                projectId,
                {
                  agentTemplateId: agentTemplateId,
                }
              ),
            exact: true,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            const [firstPage, ...restPages] = oldData.pages;

            const [_, templateAgentVersion] = response.body.version.split(':');

            return {
              ...oldData,
              pages: [
                {
                  ...firstPage,
                  body: {
                    ...firstPage.body,
                    deployedAgentTemplates: [
                      {
                        id: response.body.agentId || '',
                        version: templateAgentVersion,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        agentTemplateId: agentTemplateId,
                      },
                      ...firstPage.body.deployedAgentTemplates,
                    ],
                  },
                },
                ...restPages,
              ],
            };
          }
        );

        setOpen(false);
      },
    });

  const handleVersionNewAgent = useCallback(
    (values: VersionAgentFormValues) => {
      mutate({
        query: {
          returnAgentId: true,
        },
        body: {
          migrate_deployed_agents: values.migrate,
        },
        params: { agent_id: agentTemplateId },
      });
    },
    [mutate, agentTemplateId]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={setOpen}
        isOpen={open}
        testId="stage-agent-dialog"
        title={t('VersionAgentDialog.title')}
        onConfirm={form.handleSubmit(handleVersionNewAgent)}
        isConfirmBusy={isPending}
        trigger={
          <Button
            data-testid="stage-new-version-button"
            color="secondary"
            fullWidth
            label={t('VersionAgentDialog.trigger')}
          />
        }
      >
        <VStack gap="form">
          <Typography>{t('VersionAgentDialog.description')}</Typography>
          <Card>
            <FormField
              render={({ field }) => {
                return (
                  <Checkbox
                    checked={field.value}
                    description={t.rich(
                      'VersionAgentDialog.migrateDescription',
                      {
                        link: (chunks) => (
                          <ExternalLink href="https://docs.letta.com/api-reference/agents/migrate-agent">
                            {chunks}
                          </ExternalLink>
                        ),
                      }
                    )}
                    label={t('VersionAgentDialog.migrate')}
                    onCheckedChange={(value) => {
                      field.onChange({
                        target: {
                          value: value,
                          name: field.name,
                        },
                      });
                    }}
                  />
                );
              }}
              name="migrate"
            />
          </Card>
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

function CloudUpsellDeploy() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  return (
    <Popover
      triggerAsChild
      trigger={
        <Button
          size="small"
          color="secondary"
          preIcon={<RocketIcon size="small" />}
          data-testid="trigger-cloud-upsell"
          label={t('DeploymentButton.readyToDeploy.trigger')}
        />
      }
      align="end"
    >
      <VStack padding="medium" gap="large">
        <VStack>
          <Typography variant="heading5" bold>
            {t('CloudUpsellDeploy.title')}
          </Typography>
          <Typography>{t('CloudUpsellDeploy.description')}</Typography>
          <Button
            fullWidth
            label={t('CloudUpsellDeploy.cta')}
            href={CLOUD_UPSELL_URL}
            target="_blank"
            color="secondary"
          />
        </VStack>
      </VStack>
    </Popover>
  );
}

function TemplateVersionDisplay() {
  // get latest template version
  const { id: agentTemplateId } = useCurrentAgent();
  const agentState = useCurrentAgent();
  const { id: currentProjectId, slug: projectSlug } = useCurrentProject();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { data: deployedAgentTemplates } =
    webApi.projects.getProjectDeployedAgentTemplates.useInfiniteQuery({
      queryKey:
        webApiQueryKeys.projects.getProjectDeployedAgentTemplatesWithSearch(
          currentProjectId,
          {
            agentTemplateId: agentTemplateId,
          }
        ),
      queryData: ({ pageParam }) => ({
        params: { projectId: currentProjectId },
        query: {
          agentTemplateId,
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
    });

  const latestTemplateMetadata = useMemo(() => {
    if (!deployedAgentTemplates) {
      return null;
    }

    return deployedAgentTemplates.pages[0]?.body?.deployedAgentTemplates[0];
  }, [deployedAgentTemplates]);

  const { data: deployedAgents } = webApi.projects.getDeployedAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getDeployedAgentsWithSearch(
      currentProjectId,
      {
        deployedAgentTemplateId: latestTemplateMetadata?.id,
        limit: 1,
      }
    ),
    queryData: {
      params: {
        projectId: currentProjectId,
      },
      query: {
        deployedAgentTemplateId: latestTemplateMetadata?.id,
        limit: 1,
      },
    },
    refetchInterval: 5000,
    enabled: !!latestTemplateMetadata?.id,
  });

  const versionNumber = useMemo(() => {
    if (!latestTemplateMetadata) {
      return '';
    }

    return latestTemplateMetadata.version;
  }, [latestTemplateMetadata]);

  const { data: latestTemplate } = webOriginSDKApi.agents.getAgentById.useQuery(
    {
      enabled: !!latestTemplateMetadata?.id,
      queryData: {
        params: {
          agent_id: latestTemplateMetadata?.id || '',
        },
        query: {
          all: true,
        },
      },
      queryKey: UseAgentsServiceGetAgentKeyFn({
        agentId: latestTemplateMetadata?.id || '',
      }),
    }
  );

  const isAtLatestVersion = useMemo(() => {
    if (!latestTemplate?.body) {
      return false;
    }

    const {
      message_ids: _m,
      created_at: _c,
      metadata_: _meta,
      name: _name,
      id: _id,
      ...rest
    } = agentState;
    const {
      message_ids: _m2,
      created_at: _m3,
      metadata_: _meta2,
      name: _name2,
      id: _id2,
      ...rest2
    } = latestTemplate.body;

    return isEqual(
      generateAgentStateHash(rest, []),
      generateAgentStateHash(rest2, [])
    );
  }, [agentState, latestTemplate]);

  const { name } = useCurrentAgent();

  return (
    <Popover
      triggerAsChild
      trigger={
        <Button
          size="small"
          color="secondary"
          data-testid="version-template-trigger"
          label={t('DeploymentButton.readyToDeploy.trigger')}
          preIcon={!isAtLatestVersion ? <RocketIcon size="small" /> : undefined}
        />
      }
      align="end"
    >
      <VStack padding="medium" gap="large">
        <VStack>
          {versionNumber && (
            <HStack>
              <Badge
                color="background-grey"
                content={t('DeploymentButton.version', {
                  version: versionNumber,
                })}
              />
            </HStack>
          )}
          <Typography variant="heading5" bold>
            {isAtLatestVersion
              ? t('DeploymentButton.readyToDeploy.heading')
              : t('DeploymentButton.updateAvailable.heading')}
          </Typography>
          <Typography>
            {isAtLatestVersion
              ? t('DeploymentButton.readyToDeploy.copy')
              : t('DeploymentButton.updateAvailable.copy')}
          </Typography>
        </VStack>
        <VStack gap="small">
          {!isAtLatestVersion && <VersionAgentDialog />}
          <DeployAgentDialog isAtLatestVersion={isAtLatestVersion} />
          {deployedAgents?.body.agents &&
            deployedAgents.body.agents.length > 0 && (
              <Button
                fullWidth
                data-testid="view-deployed-agents"
                target="_blank"
                color="tertiary-transparent"
                label={t('VersionAgentDialog.deployedAgents')}
                href={`/projects/${projectSlug}/agents?template=${name}:${versionNumber}`}
              />
            )}
        </VStack>
      </VStack>
    </Popover>
  );
}

type Dialogs = 'deleteAgent' | 'forkAgent' | 'renameAgent';

function AgentSettingsDropdown() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );
  const [openDialog, setOpenDialog] = useState<Dialogs | null>(null);

  const { isTemplate } = useCurrentAgentMetaData();
  const handleCloseDialog = useCallback(() => {
    setOpenDialog(null);
  }, []);

  const agentBaseType = useAgentBaseTypeName();

  return (
    <>
      {openDialog == 'forkAgent' && (
        <ForkAgentDialog onClose={handleCloseDialog} />
      )}
      {openDialog == 'deleteAgent' && (
        <DeleteAgentDialog onClose={handleCloseDialog} />
      )}

      <DropdownMenu
        align="end"
        triggerAsChild
        trigger={
          <Button
            preIcon={<CogIcon />}
            label={t('AgentSettingsDropdown.trigger', {
              agentBaseType: agentBaseType.capitalized,
            })}
            hideLabel
            size="small"
            color="tertiary-transparent"
          />
        }
      >
        {isTemplate && (
          <DropdownMenuItem
            onClick={() => {
              setOpenDialog('forkAgent');
            }}
            preIcon={<ForkIcon />}
            label={t('ForkAgentDialog.trigger', {
              agentBaseType: agentBaseType.capitalized,
            })}
          />
        )}
        <UpdateNameDialog
          trigger={
            <DropdownMenuItem
              doNotCloseOnSelect
              preIcon={<EditIcon />}
              label={t('UpdateNameDialog.trigger', {
                agentBaseType: agentBaseType.capitalized,
              })}
            />
          }
        />

        <RestoreLayoutButton />
        <DropdownMenuItem
          onClick={() => {
            setOpenDialog('deleteAgent');
          }}
          preIcon={<TrashIcon />}
          label={t('DeleteAgentDialog.trigger', {
            agentBaseType: agentBaseType.capitalized,
          })}
        />
      </DropdownMenu>
    </>
  );
}

function Navigation() {
  const { isLocal } = useCurrentAgentMetaData();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  return (
    <DashboardHeaderNavigation
      preItems={
        <Button
          size="small"
          color="tertiary-transparent"
          label={t('Navigation.dashboard')}
          href={isLocal ? '/development-servers/local/dashboard' : '/projects'}
        />
      }
    />
  );
}

function RenderDeployButton() {
  const { isLocal, isTemplate } = useCurrentAgentMetaData();
  const user = useCurrentUser();

  if (isLocal && !user?.hasCloudAccess) {
    return <CloudUpsellDeploy />;
  }

  if (isTemplate) {
    return <TemplateVersionDisplay />;
  }

  return null;
}

interface MobileNavigationContextData {
  activePanel: string | null;
  setActivePanelId: (panelId: string | null) => void;
}

const MobileNavigationContext =
  React.createContext<MobileNavigationContextData>({
    activePanel: null,
    setActivePanelId: () => {
      return;
    },
  });

interface MobileNavigationProviderProps {
  children: React.ReactNode;
}

function MobileNavigationProvider(props: MobileNavigationProviderProps) {
  const [activePanel, setActivePanelId] = useState<string | null>(
    'agent-simulator'
  );

  const { children } = props;

  return (
    <MobileNavigationContext.Provider value={{ activePanel, setActivePanelId }}>
      {children}
    </MobileNavigationContext.Provider>
  );
}
function useMobileNavigationContext() {
  return React.useContext(MobileNavigationContext);
}

interface AgentMobileNavigationButtonType {
  panelId: string;
  onClick?: () => void;
}

function AgentMobileNavigationButton(props: AgentMobileNavigationButtonType) {
  const { panelId, onClick } = props;
  const { activePanel, setActivePanelId } = useMobileNavigationContext();
  const panelTemplateId = panelId as keyof typeof panelRegistry;

  const title = panelRegistry[panelTemplateId].useGetMobileTitle();
  const icon = panelRegistry[panelTemplateId].icon;

  const handleClick = useCallback(() => {
    setActivePanelId(panelId);
    onClick?.();
  }, [setActivePanelId, panelId, onClick]);

  return (
    <MobileFooterNavigationButton
      onClick={handleClick}
      size="large"
      preIcon={icon}
      id={`mobile-navigation-button:${panelId}`}
      color="tertiary-transparent"
      label={title}
      active={activePanel === panelId}
    />
  );
}

const MORE_PANELS = 'more-panels';

function AgentMobileNavigation() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const [expanded, setExpanded] = useState(false);
  const { activePanel } = useMobileNavigationContext();

  const panelToShowInMainNavigation = useMemo(() => {
    const firstElements = ['agent-simulator', 'agent-settings'];

    const activePanelIsFirstElement = firstElements.includes(activePanel || '');

    const defaultPanelIdsToShow = [
      ...firstElements,
      !activePanelIsFirstElement ? activePanel : 'edit-core-memories',
      MORE_PANELS,
      'edit-core-memories',
      'tools-panel',
      'edit-data-sources',
      'advanced-settings',
    ];

    const list = Array.from(new Set(defaultPanelIdsToShow));

    if (expanded) {
      return list;
    }

    return list.slice(0, 4);
  }, [activePanel, expanded]);

  return (
    <MobileFooterNavigation>
      {panelToShowInMainNavigation.map((panelId) => {
        if (panelId === MORE_PANELS) {
          return (
            <MobileFooterNavigationButton
              onClick={() => {
                setExpanded((prev) => !prev);
              }}
              id="open-more-panels"
              key={MORE_PANELS}
              size="large"
              preIcon={!expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              color="tertiary-transparent"
              label={
                !expanded
                  ? t('AgentMobileNavigation.more')
                  : t('AgentMobileNavigation.less')
              }
            />
          );
        }

        if (!panelId) {
          return null;
        }

        return (
          <AgentMobileNavigationButton
            onClick={() => {
              setExpanded(false);
            }}
            key={panelId}
            panelId={panelId}
          />
        );
      })}
    </MobileFooterNavigation>
  );
}

function AgentMobileContent() {
  const { activePanel } = useMobileNavigationContext();

  if (!activePanel) {
    return <LoaderContent />;
  }

  return (
    <VStack collapseHeight flex fullWidth>
      <RenderSinglePanel panelId={activePanel} />
    </VStack>
  );
}

function AgentPageError() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  return (
    <VStack gap="large" padding border fullWidth fullHeight flex align="center">
      <LoadingEmptyStatusComponent
        emptyMessage=""
        isError
        errorMessage={t('error')}
      />
    </VStack>
  );
}

export function AgentPage() {
  const { agentName, agentId, isTemplate, isLocal } = useCurrentAgentMetaData();

  const [adeLayout, setADELayout] = useLocalStorage({
    key: `ade-layout-${agentId}-2`,
    defaultValue: generateDefaultADELayout().displayConfig,
  });

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { data: agent } = useAgentsServiceGetAgent({
    agentId,
  });

  const fullPageWarning = useMemo(() => {
    if (isLocal) {
      return t('localAgentDevelopment');
    }

    if (!isTemplate) {
      return t('liveAgentWarning');
    }

    return null;
  }, [isLocal, isTemplate, t]);

  if (!agent) {
    return <LoaderContent />;
  }

  return (
    <PanelManagerProvider
      onPositionError={() => {
        toast.error(t('positionError'));
      }}
      fallbackPositions={generateDefaultADELayout().displayConfig}
      initialPositions={adeLayout}
      onPositionChange={(positions) => {
        setADELayout(positions);
      }}
    >
      <div className="agent-page-fade-out fixed pointer-events-none z-[-1]">
        <LoaderContent />
      </div>
      <HiddenOnMobile>
        <ADEPage
          header={
            <ADEHeader
              agent={{
                name: agentName,
              }}
            >
              <HStack gap={false} align="center">
                <Navigation />
                <HStack paddingRight="small" align="center" gap="small">
                  <AgentSettingsDropdown />
                  <RenderDeployButton />
                  <ProfilePopover size="small" />
                </HStack>
              </HStack>
            </ADEHeader>
          }
        >
          <ErrorBoundary fallback={<AgentPageError />}>
            <VStack overflow="hidden" position="relative" fullWidth fullHeight>
              {fullPageWarning && (
                <Alert variant="warning" title={fullPageWarning} />
              )}
              <Frame overflow="hidden" position="relative" fullWidth fullHeight>
                <PanelRenderer />
              </Frame>
            </VStack>
          </ErrorBoundary>
        </ADEPage>
      </HiddenOnMobile>
      <VisibleOnMobile>
        <MobileNavigationProvider>
          <ADEPage
            header={
              <ADEHeader
                agent={{
                  name: agentName,
                }}
              >
                <AgentSettingsDropdown />
              </ADEHeader>
            }
          >
            <VStack fullHeight fullWidth flex>
              <AgentMobileContent />
              <AgentMobileNavigation />
            </VStack>
          </ADEPage>
        </MobileNavigationProvider>
      </VisibleOnMobile>
    </PanelManagerProvider>
  );
}
