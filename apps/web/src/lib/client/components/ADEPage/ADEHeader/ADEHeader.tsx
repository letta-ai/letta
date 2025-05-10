import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Breadcrumb,
  Button,
  Dialog,
  DownloadIcon,
  DropdownMenu,
  DropdownMenuItem,
  ForkIcon,
  HiddenOnMobile,
  HStack,
  LettaInvaderIcon,
  Logo,
  TrashIcon,
  Typography,
  DotsVerticalIcon,
  VisibleOnMobile,
  ExternalLinkIcon,
  WarningIcon,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import type { QueryBuilderQuery } from '@letta-cloud/ui-component-library';
import { ProjectSelector } from '$web/client/components';
import React, { useCallback, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
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
import {
  DashboardHeaderNavigation,
  ProfilePopover,
} from '$web/client/components/DashboardLikeLayout/DashboardNavigation/DashboardNavigation';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';

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

  if (!canUpdateAgent) {
    return null;
  }

  return (
    <>
      {openDialog == 'forkAgent' && (
        <ForkAgentDialog onClose={handleCloseDialog} />
      )}
      <DropdownMenu
        align="center"
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
        {!isTemplate && (
          <ExportAgentButton
            trigger={
              <DropdownMenuItem
                doNotCloseOnSelect
                preIcon={<DownloadIcon />}
                label={t('AgentSettingsDropdown.download')}
              />
            }
          />
        )}
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
      className="min-h-biHeight min-w-[40px]"
      fullHeight
    >
      <Logo size="medium" color="background" />
    </HStack>
  );
}

function DesktopADEHeader(props: DesktopADEHeaderProps) {
  const { name: agentName } = props;
  const { slug } = useCurrentProject();

  const { name: projectName, id, slug: projectSlug } = useCurrentProject();

  const { template_id } = useCurrentAgent();

  const { isTemplate, isLocal } = useCurrentAgentMetaData();
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
      className="h-[40px] min-h-[40px] largerThanMobile:pr-0 pr-3 relative"
      fullWidth
      gap="small"
      color="background"
    >
      <HStack overflowX="hidden" align="center" fullHeight gap="small">
        <ProjectSelector
          trigger={
            <button className="h-full flex items-center justify-center">
              <LogoContainer />
            </button>
          }
        />
        <HStack align="center" gap={false}>
          <Breadcrumb
            size="small"
            items={[
              ...(isLocal
                ? [
                    {
                      label: t('nav.localDev'),
                      href: '/development-servers',
                      contentOverride: (
                        <Button
                          href={projectUrl}
                          color="tertiary"
                          label={t('nav.localDev')}
                          size="small"
                          _use_rarely_className="text-text-lighter inline-flex items-center gap-1.5"
                          postIcon={
                            <Tooltip content={t('localAgentDevelopment')}>
                              <span className="flex items-center justify-center">
                                <WarningIcon color="inherit" size="small" />
                              </span>
                            </Tooltip>
                          }
                        />
                      ),
                    },
                  ]
                : [
                    {
                      label: projectName,
                      href: projectUrl,
                    },
                  ]),
              ...(agentTemplate?.body.fullVersion
                ? [
                    {
                      label: agentTemplate?.body.fullVersion,
                      href: `${projectUrl}/templates/${agentTemplate?.body.templateName}`,
                    },
                  ]
                : []),
              {
                label: agentName,
              },
            ]}
          />
          <AgentSettingsDropdown icon={<DotsVerticalIcon />} />
        </HStack>
      </HStack>
      <HStack gap={false} align="center">
        <HStack align="center" gap="small">
          <DashboardHeaderNavigation />
        </HStack>
        <HStack align="center" gap="small">
          {isTemplate && (
            <Button
              size="small"
              preIcon={<LettaInvaderIcon />}
              postIcon={<ExternalLinkIcon />}
              label={t('viewAgents')}
              target="_blank"
              href={`/projects/${slug}/agents?query=${JSON.stringify({
                root: {
                  combinator: 'AND',
                  items: [
                    {
                      field: 'version',
                      queryData: {
                        operator: { label: 'equals', value: 'eq' },
                        value: {
                          label: `${agentName}:latest`,
                          value: `${agentName}:latest`,
                        },
                      },
                    },
                  ],
                },
              } satisfies QueryBuilderQuery)}`}
              color="tertiary"
            />
          )}
          <HStack paddingRight="small">
            <DeploymentButton />
          </HStack>
          <ProfilePopover size="large" />
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
