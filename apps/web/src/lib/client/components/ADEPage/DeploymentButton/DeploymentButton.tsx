import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';
import {
  Badge,
  Button,
  Checkbox,
  CloseIcon,
  CloseMiniApp,
  Dialog,
  ExternalLink,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  Input,
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
import {
  webApi,
  type webApiContracts,
  webApiQueryKeys,
  webOriginSDKApi,
} from '$web/client';
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
import { CompareTemplateVersions } from '$web/client/components';
import type { InfiniteData } from '@tanstack/query-core';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';

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

interface CreateNewTemplateVersionDialogProps {
  trigger: React.ReactNode;
}

function CreateNewTemplateVersionDialog(
  props: CreateNewTemplateVersionDialogProps,
) {
  const { trigger } = props;
  const { id: agentTemplateId } = useCurrentAgent();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const versionAgentFormSchema = useMemo(
    () =>
      z.object({
        migrate: z.boolean(),
        message: z.string().max(140, {
          message: t('VersionAgentDialog.message.maxChars'),
        }),
      }),
    [t],
  );

  const { name } = useCurrentAgent();

  type VersionAgentFormValues = z.infer<typeof versionAgentFormSchema>;
  const agentState = useCurrentAgent();

  const form = useForm<VersionAgentFormValues>({
    resolver: zodResolver(versionAgentFormSchema),
    defaultValues: {
      migrate: true,
      message: '',
    },
  });
  const { mutate, isPending } =
    webOriginSDKApi.agents.versionAgentTemplate.useMutation({
      onSuccess: (response, input) => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
          exact: false,
        });

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

        queryClient.setQueriesData<
          InfiniteData<
            ServerInferResponses<
              typeof webApiContracts.agentTemplates.listTemplateVersions,
              200
            >
          >
        >(
          {
            queryKey: webApiQueryKeys.agentTemplates
              .listTemplateVersionsWithSearch(agentTemplateId, {})
              .slice(0, -1),
            exact: false,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              pages: [
                {
                  ...oldData.pages[0],
                  body: {
                    ...oldData.pages[0].body,
                    versions: [
                      {
                        id: response.body.id,
                        version: response.body.version,
                        message: input.body?.message || '',
                        agentTemplateId: input.params?.agent_id,
                        createdAt: new Date().toISOString(),
                      },
                      ...oldData.pages[0].body.versions,
                    ],
                  },
                },
                ...oldData.pages.slice(1),
              ],
            };
          },
        );
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
          message: values.message,
        },
        params: { agent_id: agentTemplateId },
      });
    },
    [mutate, agentTemplateId],
  );
  const { deployedAgentTemplate } = useLatestAgentTemplate();

  return (
    <FormProvider {...form}>
      <MiniApp
        appName={t('VersionAgentDialog.title')}
        onOpenChange={setOpen}
        isOpen={open}
        trigger={trigger}
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
              <CompareTemplateVersions
                leftComparisonVersion="latest"
                rightComparisonVersion="current"
                defaultRightComparisonState={agentState as AgentState}
                defaultLeftComparisonState={deployedAgentTemplate?.state}
              />
              <VStack border padding>
                <VStack paddingBottom gap="form">
                  <FormField
                    render={({ field }) => {
                      return (
                        <Input
                          {...field}
                          fullWidth
                          description={t(
                            'VersionAgentDialog.message.description',
                          )}
                          label={t('VersionAgentDialog.message.label')}
                          placeholder={t(
                            'VersionAgentDialog.message.placeholder',
                          )}
                        />
                      );
                    }}
                    name="message"
                  />
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
                </VStack>
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
          </VStack>
        </form>
      </MiniApp>
    </FormProvider>
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
      <CreateNewTemplateVersionDialog
        trigger={
          <Button
            size="small"
            preIcon={<WarningIcon />}
            data-testid="stage-new-version-button"
            color="primary"
            fullWidth
            label={
              versionNumber
                ? t('DeploymentButton.updateAvailable.trigger', {
                    version: versionNumber,
                  })
                : t('DeploymentButton.updateAvailable.triggerNoVersion')
            }
          />
        }
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
