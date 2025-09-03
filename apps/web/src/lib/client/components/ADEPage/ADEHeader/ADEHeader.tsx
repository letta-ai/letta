import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import {
  Button,
  Dialog,
  FileDownloadAfIcon,
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  adeKeyMap,
  DeleteAgentDialog,
  DeleteTemplateDialog,
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
import { ProfilePopover } from '$web/client/components/DashboardLikeLayout/DashboardNavigation';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import { useNetworkInspectorVisibility } from '@letta-cloud/ui-ade-components';
import { PublishAgentFileSettingsDialog } from '$web/client/components/ADEPage/PublishAgentFileSettingsDialog/PublishAgentFileSettingsDialog';
import { ExternalVersionManagementDialog } from '$web/client/components/ADEPage/ExternalVersionManagementDialog/ExternalVersionManagementDialog';
import { useADELayoutConfig } from '@letta-cloud/ui-ade-components';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useCurrentTemplateName } from '$web/client/hooks/useCurrentTemplateName/useCurrentTemplateName';

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

  const templateName = useCurrentTemplateName();
  const { push } = useRouter();
  const { slug: projectSlug } = useCurrentProject();
  const { mutate, isPending, isError, isSuccess } =
    cloudAPI.templates.forkTemplate.useMutation();

  const handleForkAgent = useCallback(() => {
    if (isPending || isSuccess) {
      return;
    }

    mutate(
      {
        params: {
          project: projectSlug,
          template_version: `${templateName}:latest`,
        },
        body: {},
      },
      {
        onSuccess: (response) => {
          push(`/projects/${projectSlug}/templates/${response.body.name}`);
        },
      },
    );
  }, [templateName, isPending, isSuccess, mutate, projectSlug, push]);

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
        user_id: user?.id || '',
      });

      window.location.href = `/development-servers/local/dashboard`;
    } else {
      trackClientSideEvent(AnalyticsEvent.CLOUD_AGENT_DELETED, {
        user_id: user?.id || '',
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
            data-testid="agent-settings-dropdown-trigger"
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
        {isTemplate ? (
          <DeleteTemplateDialog
            templateName={name}
            projectSlug={projectSlug}
            onSuccess={handleDeleteAgentSuccess}
            trigger={
              <DropdownMenuItem
                doNotCloseOnSelect
                preIcon={<TrashIcon />}
                label={t('AgentSettingsDropdown.deleteTemplate')}
              />
            }
          />
        ) : (
          <DeleteAgentDialog
            agentId={agentTemplateId}
            agentName={name}
            trigger={
              <DropdownMenuItem
                doNotCloseOnSelect
                preIcon={<TrashIcon />}
                label={t('AgentSettingsDropdown.deleteAgent')}
              />
            }
            onSuccess={handleDeleteAgentSuccess}
          />
        )}
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
              data-testid="download-agent-file"
              doNotCloseOnSelect
              preIcon={<FileDownloadAfIcon />}
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
        <ADEHeaderLogoContainer />
        <Typography variant="body">{name}</Typography>
      </HStack>
      <AgentSettingsDropdown icon={<DotsVerticalIcon size="medium" />} />
    </HStack>
  );
}

export function ADEHeaderLogoContainer() {
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

export const DESKTOP_ADE_HEADER_CLASSNAME =
  'h-[48px] min-h-[48px] largerThanMobile:pr-0 pr-3 relative';

export function DesktopADEHeader(props: DesktopADEHeaderProps) {
  const { name: agentName } = props;

  const { name: projectName, id, slug: projectSlug } = useCurrentProject();

  const { template_id } = useCurrentAgent();

  const { isLocal, isTemplate } = useCurrentAgentMetaData();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: agentTemplates } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesWithSearch({
      template_id: template_id || '',
    }),
    queryData: {
      query: {
        template_id: template_id || '',
      },
    },
    enabled: !!template_id,
  });

  const agentTemplateVersion = useMemo(() => {
    if (!agentTemplates || agentTemplates.body.templates.length === 0) {
      return null;
    }
    const latestTemplate = agentTemplates.body.templates[0];

    const [_, wholeName] = latestTemplate.template_deployment_slug.split('/');
    const [name, version] = wholeName.split(':');

    return { name, version };
  }, [agentTemplates]);

  const projectUrl = !id ? projectSlug : `/projects/${projectSlug}`;

  return (
    <HStack
      justify="spaceBetween"
      align="center"
      /* eslint-disable-next-line react/forbid-component-props */
      className={DESKTOP_ADE_HEADER_CLASSNAME}
      fullWidth
      gap="small"
      color="background"
    >
      <HStack overflowX="hidden" align="center" fullHeight gap={false}>
        <ProjectSelector
          trigger={
            <button className="h-full gap-2 flex items-center justify-center">
              <ADEHeaderLogoContainer />
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
            {mounted && agentTemplateVersion && !isTemplate && (
              <>
                <Typography variant="body2">
                  <Link
                    data-testid={`fullversion:${agentTemplateVersion.name}:${agentTemplateVersion.version}`}
                    noUnderlineWithoutHover
                    href={`/projects/${projectSlug}/templates/${agentTemplateVersion.name}`}
                  >
                    {agentTemplateVersion.name}:{agentTemplateVersion.version}
                  </Link>
                </Typography>
                <Typography variant="body2">/</Typography>
              </>
            )}
            <Typography data-testid="ade-page-title" variant="body2">{agentName}</Typography>
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
  const { agentName, templateName, isTemplate } = useCurrentAgentMetaData();

  const name = useMemo(() => {
    if (isTemplate && templateName) {
      return templateName;
    }
    return agentName;
  }, [agentName, templateName, isTemplate]);

  return (
    <>
      <VisibleOnMobile>
        <MobileADEHeader name={name} />
      </VisibleOnMobile>
      <HiddenOnMobile>
        <DesktopADEHeader name={name} />
      </HiddenOnMobile>
    </>
  );
}
