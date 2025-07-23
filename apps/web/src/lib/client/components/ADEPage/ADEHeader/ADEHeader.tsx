import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import { useFeatureFlag, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Button,
  Dialog,
  DownloadIcon,
  DropdownMenu,
  DropdownMenuItem,
  ForkIcon,
  HiddenOnMobile,
  HStack,
  LettaInvaderOutlineIcon,
  Logo,
  TrashIcon,
  Typography,
  DotsVerticalIcon,
  VisibleOnMobile,
  TroubleshootIcon,
  HotKey,
  DropdownMenuSeparator,
  CloudSyncIcon,
  ProjectsIcon,
  DotsHorizontalIcon,
  Link,
  DockRightIcon,
  DockLeftIcon,
} from '@letta-cloud/ui-component-library';
import { ProjectSelector } from '$web/client/components';
import React, { useCallback, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  adeKeyMap,
  DeleteAgentDialog,
  ExportAgentButton,
  useCurrentAgentMetaData,
} from '@letta-cloud/ui-ade-components';
import { useAgentBaseTypeName } from '$web/client/hooks/useAgentBaseNameType/useAgentBaseNameType';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useRouter } from 'next/navigation';
import { DeploymentButton } from '$web/client/components/ADEPage/DeploymentButton/DeploymentButton';
import { ProfilePopover } from '$web/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigation';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import { useNetworkInspectorVisibility } from '@letta-cloud/ui-ade-components';
import { PublishAgentFileSettingsDialog } from '$web/client/components/ADEPage/PublishAgentFileSettingsDialog/PublishAgentFileSettingsDialog';
import { ExternalVersionManagementDialog } from '$web/client/components/ADEPage/ExternalVersionManagementDialog/ExternalVersionManagementDialog';
import { useADELayoutConfig } from '@letta-cloud/ui-ade-components';

interface DesktopADEHeaderProps {
  name: string;
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

type Dialogs = 'deleteAgent' | 'forkAgent' | 'renameAgent';

interface AgentSettingsDropdownProps {
  icon: React.ReactNode;
}

function AgentSettingsDropdown(props: AgentSettingsDropdownProps) {
  const { icon } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );
  const [openDialog, setOpenDialog] = useState<Dialogs | null>(null);

  const { isTemplate } = useCurrentAgentMetaData();
  const handleCloseDialog = useCallback(() => {
    setOpenDialog(null);
  }, []);

  const agentBaseType = useAgentBaseTypeName();

  const [canUpdateAgent] = useUserHasPermission(
    ApplicationServices.UPDATE_AGENT,
  );

  const user = useCurrentUser();
  const { slug: projectSlug } = useCurrentProject();
  const { isLocal } = useCurrentAgentMetaData();

  const handleDeleteAgentSuccess = useCallback(() => {
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
  }, [isLocal, projectSlug, user]);

  const { name } = useCurrentAgent();

  const { id: agentTemplateId } = useCurrentAgent();

  const { data: showShareAgentFile } = useFeatureFlag('SHARE_AGENT_FILE');
  const { data: showVersionSyncSettings } = useFeatureFlag(
    'EXTERNAL_VERSION_SYNC_SETTINGS',
  );

  if (!canUpdateAgent) {
    return null;
  }

  return (
    <>
      {openDialog == 'forkAgent' && (
        <ForkAgentDialog onClose={handleCloseDialog} />
      )}
      <DropdownMenu
        align="start"
        triggerAsChild
        trigger={
          <Button
            size="small"
            preIcon={icon}
            label={t('AgentSettingsDropdown.trigger', {
              agentBaseType: agentBaseType.capitalized,
            })}
            hideLabel
            color="tertiary"
          />
        }
      >
        <NetworkInspectorButton />
        <DropdownMenuSeparator />
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
        <DeleteAgentDialog
          agentId={agentTemplateId}
          agentName={name}
          trigger={
            <DropdownMenuItem
              doNotCloseOnSelect
              preIcon={<TrashIcon />}
              label={t('AgentSettingsDropdown.delete', {
                agentBaseType: agentBaseType.capitalized,
              })}
            />
          }
          onSuccess={handleDeleteAgentSuccess}
        />
        <DropdownMenuSeparator />
        {showShareAgentFile && (
          <PublishAgentFileSettingsDialog
            agentId={agentTemplateId}
            agentName={name}
            trigger={
              <DropdownMenuItem
                doNotCloseOnSelect
                preIcon={<LettaInvaderOutlineIcon />}
                label={t('AgentSettingsDropdown.publish')}
              />
            }
          />
        )}
        <ExportAgentButton
          trigger={
            <DropdownMenuItem
              doNotCloseOnSelect
              preIcon={<DownloadIcon />}
              label={t('AgentSettingsDropdown.download')}
            />
          }
        />
        {isTemplate && showVersionSyncSettings && (
          <>
            <DropdownMenuSeparator />
            <ExternalVersionManagementDialog
              trigger={
                <DropdownMenuItem
                  doNotCloseOnSelect
                  preIcon={<CloudSyncIcon />}
                  label={t('AgentSettingsDropdown.externalVersionManagement')}
                />
              }
            />
          </>
        )}
      </DropdownMenu>
    </>
  );
}

function MobileADEHeader(props: DesktopADEHeaderProps) {
  const { name } = props;

  return (
    <HStack justify="spaceBetween" align="center" fullWidth color="background">
      <HStack align="center">
        <LogoContainer />
        <Typography variant="body">{name}</Typography>
      </HStack>
      <AgentSettingsDropdown icon={<DotsVerticalIcon size="medium" />} />
    </HStack>
  );
}

function LogoContainer() {
  return (
    <HStack
      align="center"
      justify="center"
      color="brand"
      /* eslint-disable-next-line react/forbid-component-props */
      className="min-h-biHeight min-w-[48px]"
      fullHeight
    >
      <Logo size="medium" color="background" />
    </HStack>
  );
}

function NetworkInspectorButton() {
  const [_, setNetworkInspectorOpen] = useNetworkInspectorVisibility();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  return (
    <DropdownMenuItem
      preIcon={<TroubleshootIcon />}
      label={t('AgentSettingsDropdown.networkInspector')}
      badge={<HotKey command={adeKeyMap.OPEN_NETWORK_INSPECTOR.command} />}
      onClick={() => {
        setNetworkInspectorOpen((prev) => ({
          ...prev,
          isOpen: !prev.isOpen,
        }));
      }}
    />
  );
}

function Actions() {
  const t = useTranslations('DesktopADEHeader/Actions');

  const {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    toggleRightPanel,
    toggleLeftPanel,
  } = useADELayoutConfig();

  return (
    <HStack gap={false} paddingRight="xsmall">
      <Button
        preIcon={
          <DockLeftIcon color={!isLeftSidebarOpen ? 'muted' : 'default'} />
        }
        hideLabel
        size="small"
        onClick={toggleLeftPanel}
        label={
          isLeftSidebarOpen
            ? t('toggleLeftSidebar.hide')
            : t('toggleLeftSidebar.show')
        }
        color="tertiary"
      />
      <Button
        preIcon={
          <DockRightIcon color={!isRightSidebarOpen ? 'muted' : 'default'} />
        }
        hideLabel
        onClick={toggleRightPanel}
        size="small"
        label={
          isRightSidebarOpen
            ? t('toggleRightSidebar.hide')
            : t('toggleRightSidebar.show')
        }
        color="tertiary"
      />
    </HStack>
  );
}

function DesktopADEHeader(props: DesktopADEHeaderProps) {
  const { name: agentName } = props;

  const { name: projectName, id, slug: projectSlug } = useCurrentProject();

  const { template_id } = useCurrentAgent();

  const { isLocal } = useCurrentAgentMetaData();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const { data: agentTemplate } =
    webApi.agentTemplates.getDeployedAgentTemplateById.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getDeployedAgentTemplateById(
        template_id || '',
      ),
      queryData: {
        params: {
          id: template_id || '',
        },
      },
      enabled: !!template_id,
    });

  const projectUrl = !id ? projectSlug : `/projects/${projectSlug}`;

  return (
    <HStack
      justify="spaceBetween"
      align="center"
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[48px] min-h-[48px] largerThanMobile:pr-0 pr-3 relative"
      fullWidth
      gap="small"
      color="background"
    >
      <HStack overflowX="hidden" align="center" fullHeight gap={false}>
        <ProjectSelector
          trigger={
            <button className="h-full gap-2 flex items-center justify-center">
              <LogoContainer />
            </button>
          }
        />
        <HStack align="center" paddingLeft="medium" gap="medium">
          <Button
            href={isLocal ? '/development-servers' : projectUrl}
            preIcon={<ProjectsIcon size="medium" color="default" />}
            label={
              isLocal ? t('nav.localDev') : t('nav.project', { projectName })
            }
            hideLabel
            size="small"
            color="tertiary"
          />
          <HStack align="center">
            {agentTemplate?.body.fullVersion && (
              <>
                <Typography variant="body2">
                  <Link
                    data-testid={`fullversion:${agentTemplate.body.fullVersion}`}
                    noUnderlineWithoutHover
                    href={`/projects/${projectSlug}/templates/${agentTemplate.body.templateName}`}
                  >
                    {agentTemplate.body.fullVersion}
                  </Link>
                </Typography>
                <Typography variant="body2">/</Typography>
              </>
            )}
            <Typography variant="body2">{agentName}</Typography>
          </HStack>
          <AgentSettingsDropdown icon={<DotsHorizontalIcon />} />
        </HStack>
      </HStack>
      <HStack gap={false} align="center">
        <HStack paddingRight="small" align="center" gap="small">
          <Actions />
          <HStack paddingRight="xxsmall">
            <DeploymentButton />
          </HStack>
          <ProfilePopover size="medium" />
        </HStack>
      </HStack>
    </HStack>
  );
}

export function ADEHeader() {
  const { agentName } = useCurrentAgentMetaData();
  return (
    <>
      <VisibleOnMobile>
        <MobileADEHeader name={agentName} />
      </VisibleOnMobile>
      <HiddenOnMobile>
        <DesktopADEHeader name={agentName} />
      </HiddenOnMobile>
    </>
  );
}
