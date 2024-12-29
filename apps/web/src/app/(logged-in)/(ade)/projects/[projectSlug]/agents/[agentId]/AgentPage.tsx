'use client';
import {
  panelRegistry,
  usePanelManager,
  RenderSinglePanel,
} from './panelRegistry';
import { PanelManagerProvider, PanelRenderer } from './panelRegistry';
import {
  ChevronDownIcon,
  HiddenOnMobile,
  MobileFooterNavigation,
  MobileFooterNavigationButton,
  LoadingEmptyStatusComponent,
  Tooltip,
  Logo,
  Breadcrumb,
} from '@letta-web/component-library';
import { TrashIcon } from '@letta-web/component-library';
import {
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import {
  CogIcon,
  DropdownMenu,
  DropdownMenuItem,
} from '@letta-web/component-library';
import { toast } from '@letta-web/component-library';
import { LayoutIcon } from '@letta-web/component-library';
import {
  Alert,
  Button,
  Dialog,
  Frame,
  HStack,
  LettaLoader,
  Typography,
  VisibleOnMobile,
  ChevronUpIcon,
  ForkIcon,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useMemo, useState } from 'react';
import {
  REMOTE_DEVELOPMENT_ID,
  useCurrentProject,
} from '../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { webApi } from '$web/client';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$web/client/hooks';
import { ProjectSelector } from '$web/client/components';
import './AgentPage.scss';
import { useCurrentAgentMetaData } from './hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from './hooks';
import {
  useAgentsServiceDeleteAgent,
  useAgentsServiceGetAgent,
} from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { generateDefaultADELayout } from '$web/utils';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAgentBaseTypeName } from './hooks/useAgentBaseNameType/useAgentBaseNameType';
import { useLocalStorage } from '@mantine/hooks';
import { ErrorBoundary } from 'react-error-boundary';
import {
  DashboardHeaderNavigation,
  ProfilePopover,
} from '$web/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigation';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';
import {
  DeploymentButton,
  isAgentConvertingToTemplateAtom,
} from './DeploymentButton/DeploymentButton';
import Link from 'next/link';
import { useAtomValue } from 'jotai';

interface ADEHeaderProps {
  children?: React.ReactNode;
  agent: {
    name: string;
  };
}

function LogoContainer() {
  return (
    <HStack
      align="center"
      justify="center"
      color="primary"
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[38px] min-w-[40px]"
      fullHeight
    >
      <Logo size="small" />
    </HStack>
  );
}

function ADEHeader(props: ADEHeaderProps) {
  const { agent } = props;
  const { name: agentName } = agent;
  const { name: projectName, id, slug: projectSlug } = useCurrentProject();
  const t = useTranslations('ADE/ADEHeader');

  return (
    <HStack
      justify="spaceBetween"
      align="center"
      border
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[40px] min-h-[40px] largerThanMobile:pr-0 pr-3 relative"
      fullWidth
      color="background"
    >
      <HiddenOnMobile>
        <HStack overflowX="hidden" align="center" fullHeight gap="small">
          <ProjectSelector
            trigger={
              <button className="h-full flex items-center justify-center">
                <LogoContainer />
              </button>
            }
          />
          <HStack gap={false}>
            <Breadcrumb
              variant="small"
              items={[
                {
                  label: projectName,
                  href:
                    id === REMOTE_DEVELOPMENT_ID
                      ? projectSlug
                      : `/projects/${projectSlug}`,
                },
                {
                  label: agentName,
                },
              ]}
            />
            <AgentSettingsDropdown />
          </HStack>
        </HStack>
        {props.children}
      </HiddenOnMobile>
      <VisibleOnMobile>
        <HStack
          position="relative"
          align="center"
          fullWidth
          fullHeight
          gap={false}
        >
          <Tooltip content={t('returnToHome')}>
            <Link href="/">
              <LogoContainer />
            </Link>
          </Tooltip>
          <HStack justify="center" fullWidth align="center">
            <Typography variant="body">{agentName}</Typography>
          </HStack>
        </HStack>
        {props.children}
      </VisibleOnMobile>
    </HStack>
  );
}

function RestoreLayoutButton() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
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
    [name],
  );

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const form = useForm<z.infer<typeof DeleteAgentDialogFormSchema>>({
    resolver: zodResolver(DeleteAgentDialogFormSchema),
    defaultValues: {
      agentName: '',
    },
  });

  const { mutate, isPending, isSuccess, isError } = useAgentsServiceDeleteAgent(
    {
      onSuccess: () => {
        if (isLocal) {
          trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_DELETED, {
            userId: user?.id || '',
          });

          window.location.href = `/development-servers/local/dashboard`;
        } else {
          trackClientSideEvent(AnalyticsEvent.CLOUD_AGENT_DELETED, {
            userId: user?.id || '',
          });

          window.location.href = `/projects/${projectSlug}`;
        }
      },
    },
  );

  const agentBaseType = useAgentBaseTypeName();

  const handleSubmit = useCallback(() => {
    mutate({
      agentId: agentTemplateId,
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
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const agentBaseType = useAgentBaseTypeName();

  const { id: agentTemplateId } = useCurrentAgent();
  const { push } = useRouter();
  const { id: projectId, slug: projectSlug } = useCurrentProject();
  const { mutate, isPending, isError, isSuccess } =
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
      },
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
      errorMessage={isError ? t('ForkAgentDialog.error') : undefined}
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

type Dialogs = 'deleteAgent' | 'forkAgent' | 'renameAgent';

function AgentSettingsDropdown() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
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
        align="center"
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
  return <DashboardHeaderNavigation />;
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
    'agent-simulator',
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
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
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
      <VisibleOnMobile checkWithJs>
        <RenderSinglePanel panelId={activePanel} />
      </VisibleOnMobile>
    </VStack>
  );
}

interface ADEPageProps {
  children: React.ReactNode;
  header: React.ReactNode;
}

function ADEPage(props: ADEPageProps) {
  return (
    <VStack
      overflow="hidden"
      color="background"
      /* eslint-disable-next-line react/forbid-component-props */
      className="w-[100vw] p-[8px] h-[100dvh]"
      fullHeight
      fullWidth
      gap
    >
      {props.header}
      <HStack
        collapseHeight
        overflowY="auto"
        fullWidth
        gap={false}
        /* eslint-disable-next-line react/forbid-component-props */
        className="flex-row-reverse"
      >
        {props.children}
      </HStack>
    </VStack>
  );
}

function AgentPageError() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
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
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  useAgentsServiceGetAgent({
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

  const isAgentConvertingToTemplate = useAtomValue(
    isAgentConvertingToTemplateAtom,
  );

  if (isAgentConvertingToTemplate) {
    return (
      <div className="w-[100dvw] h-[100dvh] flex flex-col items-center justify-center">
        <VStack
          gap="large"
          padding
          border
          fullWidth
          fullHeight
          flex
          align="center"
        >
          <LoadingEmptyStatusComponent
            emptyMessage=""
            isError
            errorMessage={t('convertingToTemplate')}
          />
        </VStack>
      </div>
    );
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
                <HStack paddingRight="small" align="center" gap="small">
                  <Navigation />
                </HStack>
                <HStack paddingRight="small" align="center" gap="small">
                  <DeploymentButton />
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
                <HiddenOnMobile checkWithJs>
                  <PanelRenderer />
                </HiddenOnMobile>
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
