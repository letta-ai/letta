import { useCurrentAgent } from '../../../../../app/(logged-in)/(ade)/projects/[projectSlug]/agents/[agentId]/hooks';
import { useCurrentProject } from '../../../../../app/(logged-in)/(dashboard-like)/projects/[projectSlug]/hooks';
import { useTranslations } from '@letta-cloud/translations';
import {
  AgentStateViewer,
  Badge,
  Button,
  Card,
  Checkbox,
  CloseIcon,
  CloseMiniApp,
  Dialog,
  ExternalLink,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  LettaLoader,
  MiniApp,
  Popover,
  RocketIcon,
  TemplateIcon,
  toast,
  Tooltip,
  Typography,
  useForm,
  VStack,
  WarningIcon,
} from '@letta-cloud/component-library';
import { DeployAgentUsageInstructions } from '$web/client/code-reference/DeployAgentUsageInstructions';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$web/client';
import { CLOUD_UPSELL_URL } from '$web/constants';
import type { AgentState } from '@letta-cloud/letta-agents-api';
import { isAgentState } from '@letta-cloud/letta-agents-api';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/web-api-client';
import { atom, useSetAtom } from 'jotai';
import { get } from 'lodash-es';
import { compareAgentStates } from '@letta-cloud/generic-utils';
import { useCurrentAgentMetaData } from '@letta-cloud/shared-ade-components';
import { ApplicationServices } from '@letta-cloud/rbac';

interface DeployAgentDialogProps {
  isAtLatestVersion: boolean;
  deployedTemplateId: string;
}

function DeployAgentDialog(props: DeployAgentDialogProps) {
  const { isAtLatestVersion, deployedTemplateId } = props;
  const { name } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  return (
    <Dialog
      title={t('DeployAgentDialog.title')}
      size="xlarge"
      trigger={
        <Button
          fullWidth
          data-testid="deploy-agent-dialog-trigger"
          color={!isAtLatestVersion ? 'tertiary' : 'primary'}
          label={t('DeployAgentDialog.trigger')}
          target="_blank"
        />
      }
      hideConfirm
    >
      <DeployAgentUsageInstructions
        deployedTemplateId={deployedTemplateId}
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

interface VersionAgentDialogProps {
  currentAgentState: AgentState;
  versionedAgentState: AgentState;
  latestVersion: string;
}

function VersionAgentDialog(props: VersionAgentDialogProps) {
  const { name } = useCurrentAgent();
  const { currentAgentState, versionedAgentState, latestVersion } = props;
  const { id: agentTemplateId } = useCurrentAgent();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
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
          ServerInferResponses<
            typeof contracts.agentTemplates.getAgentTemplateByVersion,
            200
          >
        >(
          {
            queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateByVersion(
              `${name}:latest`,
            ),
            exact: true,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: response.body,
            };
          },
        );

        setOpen(false);
      },
    });

  const handleVersionNewAgent = useCallback(
    (values: VersionAgentFormValues) => {
      mutate({
        query: {
          returnAgentState: true,
        },
        body: {
          migrate_deployed_agents: values.migrate,
        },
        params: { agent_id: agentTemplateId },
      });
    },
    [mutate, agentTemplateId],
  );

  return (
    <FormProvider {...form}>
      <MiniApp
        appName={t('VersionAgentDialog.title')}
        onOpenChange={setOpen}
        isOpen={open}
        trigger={
          <Button
            size="small"
            preIcon={<WarningIcon />}
            data-testid="stage-new-version-button"
            color="primary"
            fullWidth
            label={
              latestVersion
                ? t('DeploymentButton.updateAvailable.trigger', {
                    version: latestVersion,
                  })
                : t('DeploymentButton.updateAvailable.triggerNoVersion')
            }
          />
        }
      >
        <form
          className="contents"
          onSubmit={form.handleSubmit(handleVersionNewAgent)}
        >
          <VStack overflow="hidden" fullHeight gap={false}>
            <HStack
              height="header"
              align="center"
              justify="spaceBetween"
              borderBottom
              paddingX
              fullWidth
            >
              <HStack>
                <RocketIcon />
                <Typography bold>{t('VersionAgentDialog.title')}</Typography>
              </HStack>
              <CloseMiniApp data-testid="close-advanced-core-memory-editor">
                <HStack>
                  <CloseIcon />
                </HStack>
              </CloseMiniApp>
            </HStack>
            <VStack padding fullHeight overflow="hidden">
              <VStack flex collapseHeight>
                <HStack border gap={false}>
                  <VStack
                    flex
                    fullWidth
                    borderRight
                    paddingRight="none"
                    padding="small"
                  >
                    <Typography bold>{`${name}:${latestVersion}`}</Typography>
                  </VStack>
                  <VStack flex fullWidth padding="small" color="brand-light">
                    <Typography bold>
                      {t('VersionAgentDialog.current')}
                    </Typography>
                  </VStack>
                </HStack>
                <VStack border flex collapseHeight overflowY="auto">
                  <AgentStateViewer
                    baseState={versionedAgentState}
                    comparedState={currentAgentState}
                  />
                </VStack>
              </VStack>
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
                          },
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
              <FormActions>
                <Button
                  data-testid="deploy-agent-dialog-trigger"
                  color="primary"
                  busy={isPending}
                  label={t('VersionAgentDialog.confirm')}
                />
              </FormActions>
            </VStack>
          </VStack>
        </form>
      </MiniApp>
    </FormProvider>
  );
}

function CloudUpsellDeploy() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  return (
    <Popover
      triggerAsChild
      trigger={
        <Button
          size="small"
          color="primary"
          preIcon={<RocketIcon size="small" />}
          data-testid="trigger-cloud-upsell"
          label={t('CloudUpsellDeploy.trigger')}
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
            color="primary"
          />
        </VStack>
      </VStack>
    </Popover>
  );
}

function useLatestAgentTemplate() {
  const { name } = useCurrentAgent();

  const {
    data: deployedAgentTemplate,
    error,
    isError,
  } = webApi.agentTemplates.getAgentTemplateByVersion.useQuery({
    queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateByVersion(
      `${name}:latest`,
    ),
    queryData: {
      params: { slug: `${name}:latest` },
    },
    retry: false,
  });

  return {
    deployedAgentTemplate: deployedAgentTemplate?.body,
    notFoundError: isError && get(error, 'status') === 404,
    otherError: isError && get(error, 'status') !== 404,
  };
}

function TemplateVersionDisplay() {
  // get latest template version
  const agentState = useCurrentAgent();
  const { deployedAgentTemplate, notFoundError, otherError } =
    useLatestAgentTemplate();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const [canUpdateTemplate] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  const isAtLatestVersion = useMemo(() => {
    if (notFoundError) {
      return false;
    }

    if (!deployedAgentTemplate?.state || !isAgentState(agentState)) {
      return true;
    }

    return compareAgentStates(agentState, deployedAgentTemplate.state);
  }, [deployedAgentTemplate, notFoundError, agentState]);

  const versionNumber = deployedAgentTemplate?.version;

  const isLoading = useMemo(() => {
    return !deployedAgentTemplate && !notFoundError && !otherError;
  }, [deployedAgentTemplate, notFoundError, otherError]);

  if (otherError) {
    return (
      <Tooltip asChild content={t('DeploymentButton.errorTooltip')}>
        <Button
          size="small"
          color="destructive"
          data-testid="version-template-trigger"
          label={t('DeploymentButton.error')}
          preIcon={<WarningIcon size="small" />}
        />
      </Tooltip>
    );
  }

  if (!canUpdateTemplate) {
    return (
      <Button
        size="small"
        color="primary"
        disabled
        label={t('DeploymentButton.readyToDeploy.trigger', {
          version: versionNumber,
        })}
      />
    );
  }

  if (isAtLatestVersion || isLoading) {
    return (
      <Popover
        triggerAsChild
        trigger={
          <Button
            busy={isLoading}
            size="small"
            color="primary"
            data-testid="version-template-trigger"
            label={
              versionNumber
                ? t('DeploymentButton.readyToDeploy.trigger', {
                    version: versionNumber,
                  })
                : t('DeploymentButton.readyToDeploy.triggerNoVersion')
            }
            preIcon={
              isAtLatestVersion ? (
                <RocketIcon size="small" />
              ) : (
                <WarningIcon size="small" />
              )
            }
          />
        }
        align="end"
      >
        {isLoading ? (
          <VStack align="center" justify="center" padding>
            <LettaLoader variant="grower" />
            <Typography>{t('DeploymentButton.loading')}</Typography>
          </VStack>
        ) : (
          <VStack padding="medium" gap="large">
            <VStack>
              {deployedAgentTemplate?.version && (
                <HStack>
                  <Badge
                    content={t('DeploymentButton.version', {
                      version: deployedAgentTemplate?.version,
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
                  : versionNumber
                    ? t('DeploymentButton.updateAvailable.copy', {
                        version: versionNumber,
                      })
                    : t('DeploymentButton.updateAvailable.copyNoVersion')}
              </Typography>
            </VStack>
            <VStack gap="small">
              <DeployAgentDialog
                deployedTemplateId={deployedAgentTemplate?.id || ''}
                isAtLatestVersion={isAtLatestVersion}
              />
            </VStack>
          </VStack>
        )}
      </Popover>
    );
  }

  return (
    deployedAgentTemplate?.state &&
    isAgentState(agentState) && (
      <VersionAgentDialog
        latestVersion={versionNumber || ''}
        versionedAgentState={deployedAgentTemplate.state}
        currentAgentState={agentState}
      />
    )
  );
}

export const isAgentConvertingToTemplateAtom = atom(false);

function CreateTemplateButton() {
  const { slug } = useCurrentProject();
  const { id: agentId } = useCurrentAgent();
  const setConvertingAtom = useSetAtom(isAgentConvertingToTemplateAtom);
  const { mutate, isPending, isSuccess } =
    webOriginSDKApi.agents.createTemplateFromAgent.useMutation({
      onSuccess: (body) => {
        const { templateName } = body.body;

        // do not use next/link here as we need to force a full page reload
        window.location.href = `/projects/${slug}/templates/${templateName}`;
      },
      onError: () => {
        setConvertingAtom(false);
        toast.error(t('CreateTemplateButton.error'));
      },
    });

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const handleConvert = useCallback(() => {
    setConvertingAtom(true);

    mutate({
      params: { agent_id: agentId },
      body: {
        project: slug,
      },
    });
  }, [setConvertingAtom, mutate, agentId, slug]);

  return (
    <Popover
      align="end"
      triggerAsChild
      trigger={
        <Button
          size="small"
          preIcon={<TemplateIcon />}
          color="primary"
          label={t('CreateTemplateButton.trigger')}
        />
      }
    >
      <VStack padding="medium" gap="large">
        <VStack>
          <Typography bold>{t('CreateTemplateButton.title')}</Typography>
          <Typography>{t('CreateTemplateButton.description')}</Typography>
        </VStack>
        <Button
          color="primary"
          busy={isPending || isSuccess}
          fullWidth
          label={t('CreateTemplateButton.cta')}
          type="button"
          onClick={handleConvert}
        />
      </VStack>
    </Popover>
  );
}

export function DeploymentButton() {
  const { isLocal, isTemplate, isFromTemplate } = useCurrentAgentMetaData();
  const user = useCurrentUser();

  if (isLocal || !user?.hasCloudAccess) {
    return <CloudUpsellDeploy />;
  }

  if (isTemplate) {
    return <TemplateVersionDisplay />;
  }

  if (!isFromTemplate) {
    return <CreateTemplateButton />;
  }

  return null;
}
