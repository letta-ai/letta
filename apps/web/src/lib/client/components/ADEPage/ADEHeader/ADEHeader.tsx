import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Breadcrumb,
  Button,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  ForkIcon,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HStack,
  Input,
  LettaInvaderIcon,
  Logo,
  TrashIcon,
  Typography,
  useForm,
  VerticalDotsIcon,
  VisibleOnMobile,
} from '@letta-cloud/ui-component-library';
import type { QueryBuilderQuery } from '@letta-cloud/ui-component-library';
import { ProjectSelector } from '$web/client/components';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { useAgentBaseTypeName } from '$web/client/hooks/useAgentBaseNameType/useAgentBaseNameType';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAgentsServiceDeleteAgent } from '@letta-cloud/sdk-core';
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

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const DeleteAgentDialogFormSchema = useMemo(
    () =>
      z.object({
        agentName: z.literal(name, {
          message: t('DeleteAgentDialog.nameError'),
        }),
      }),
    [name, t],
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
            strong: (chunks) => (
              <Typography overrideEl="span" bold>
                {chunks}
              </Typography>
            ),
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

  if (!canUpdateAgent) {
    return null;
  }

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
            preIcon={icon}
            label={t('AgentSettingsDropdown.trigger', {
              agentBaseType: agentBaseType.capitalized,
            })}
            hideLabel
            size="small"
            color="tertiary"
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

function MobileADEHeader(props: DesktopADEHeaderProps) {
  const { name } = props;

  return (
    <HStack justify="spaceBetween" align="center" fullWidth color="background">
      <HStack align="center">
        <LogoContainer />
        <Typography variant="body">{name}</Typography>
      </HStack>
      <AgentSettingsDropdown icon={<VerticalDotsIcon size="medium" />} />
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
      className="h-[38px] min-w-[40px]"
      fullHeight
    >
      <Logo size="small" />
    </HStack>
  );
}

function DesktopADEHeader(props: DesktopADEHeaderProps) {
  const { name: agentName } = props;
  const { slug } = useCurrentProject();

  const { name: projectName, id, slug: projectSlug } = useCurrentProject();

  const { template_id } = useCurrentAgent();

  const { isTemplate } = useCurrentAgentMetaData();
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
      border
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[40px] min-h-[40px] largerThanMobile:pr-0 pr-3 relative"
      fullWidth
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
        <HStack gap={false}>
          <Breadcrumb
            variant="small"
            items={[
              {
                label: projectName,
                href: projectUrl,
              },
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
          <AgentSettingsDropdown icon={<DotsHorizontalIcon />} />
        </HStack>
      </HStack>
      <HStack gap={false} align="center">
        <HStack paddingRight="small" align="center" gap="small">
          <DashboardHeaderNavigation />
        </HStack>
        <HStack paddingRight="small" align="center" gap="small">
          <DeploymentButton />
          {isTemplate && (
            <Button
              preIcon={<LettaInvaderIcon />}
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
              size="small"
              color="secondary"
            />
          )}
          <ProfilePopover size="small" />
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
