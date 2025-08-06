import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';
import {
  Badge,
  Button,
  Checkbox,
  CloseIcon,
  CloseMiniApp,
  ExternalLink,
  FormField,
  FormProvider,
  HStack,
  MiniApp,
  Popover,
  TemplateIcon,
  TextArea,
  toast,
  Tooltip,
  Typography,
  useForm,
  VStack,
  WarningIcon,
  HiddenOnMobile,
  VisibleOnMobile,
  RocketIcon,
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '@letta-cloud/ui-ade-components';

import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { type webApiContracts, webApiQueryKeys } from '$web/client';
import { CLOUD_UPSELL_URL } from '$web/constants';
import type { AgentState } from '@letta-cloud/sdk-core';
import { useUserHasPermission } from '$web/client/hooks';
import type { ServerInferResponses } from '@ts-rest/core';
import { type contracts, useSetOnboardingStep } from '@letta-cloud/sdk-web';
import { atom, useSetAtom } from 'jotai';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { CompareTemplateVersions } from '$web/client/components';
import type { InfiniteData } from '@tanstack/query-core';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import { useLatestAgentTemplate } from '$web/client/hooks/useLatestAgentTemplate/useLatestAgentTemplate';
import { cloudAPI } from '@letta-cloud/sdk-cloud-api';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';

function CloudUpsellDeploy() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  return (
    <Popover
      triggerAsChild
      trigger={
        <Button
          size="default"
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

interface FormFieldsProps {
  isPending: boolean;
}

function FormFields(props: FormFieldsProps) {
  const { isPending } = props;

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );
  return (
    <VStack fullHeight padding>
      <VStack fullWidth fullHeight paddingBottom gap="xlarge">
        <FormField
          render={({ field }) => {
            return (
              <TextArea
                {...field}
                autosize
                minRows={4}
                rows={3}
                fullWidth
                label={t('VersionAgentDialog.message.label')}
                placeholder={t('VersionAgentDialog.message.placeholder')}
              />
            );
          }}
          name="message"
        />
        <FormField
          render={({ field }) => {
            return (
              <Checkbox
                data-testid="version-agent-dialog-migrate-checkbox"
                size="large"
                checked={field.value}
                description={t.rich('VersionAgentDialog.migrateDescription', {
                  link: (chunks) => (
                    <ExternalLink href="https://docs.letta.com/api-reference/agents/migrate-agent">
                      {chunks}
                    </ExternalLink>
                  ),
                })}
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
      <Button
        data-testid="deploy-agent-dialog-trigger"
        color="primary"
        fullWidth
        bold
        size="large"
        busy={isPending}
        label={t('VersionAgentDialog.confirm')}
      />
    </VStack>
  );
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

  const { setOnboardingStep } = useSetOnboardingStep();
  const showOnboardingMessage = useShowOnboarding('save_version');

  type VersionAgentFormValues = z.infer<typeof versionAgentFormSchema>;
  const agentState = useCurrentAgent();

  const form = useForm<VersionAgentFormValues>({
    resolver: zodResolver(versionAgentFormSchema),
    defaultValues: {
      migrate: false,
      message: '',
    },
  });
  const { mutate, isPending } =
    cloudAPI.agents.versionAgentTemplate.useMutation({
      onSuccess: (response, input) => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
          exact: false,
        });

        void queryClient.refetchQueries({
          queryKey: webApiQueryKeys.agentTemplates.listAgentMigrations({
            templateName: name || '',
          }),
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

        if (showOnboardingMessage) {
          setOnboardingStep({
            stepToClaim: 'save_version',
            onboardingStep: 'deploy_agent',
          });
        }
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
        backdrop
        __use__rarely__className="widescreen:max-w-[1440px]"
        trigger={trigger}
      >
        <form
          className="contents"
          onSubmit={form.handleSubmit(handleVersionNewAgent)}
        >
          <VStack overflow="hidden" fullHeight gap={false}>
            <HStack
              color="background-grey2"
              height="header"
              align="center"
              justify="spaceBetween"
              paddingX
              fullWidth
            >
              <HStack>
                <Typography bold>{t('VersionAgentDialog.title')}</Typography>
              </HStack>
              <CloseMiniApp data-testid="close-advanced-core-memory-editor">
                <HStack>
                  <CloseIcon />
                </HStack>
              </CloseMiniApp>
            </HStack>
            {showOnboardingMessage && (
              <VStack paddingX paddingTop>
                <HStack color="brand-light" padding="small">
                  <VStack>
                    <HStack>
                      <Badge
                        content={t('VersionAgentDialog.onboarding.badge')}
                      />
                    </HStack>
                    <Typography>
                      {t('VersionAgentDialog.onboarding.title')}
                    </Typography>
                  </VStack>
                </HStack>
              </VStack>
            )}
            <HiddenOnMobile checkWithJs>
              <HStack fullWidth fullHeight gap={false} overflow="hidden">
                <VStack fullWidth fullHeight flex overflow="hidden">
                  <VStack
                    padding
                    fullWidth
                    collapseHeight
                    flex
                    overflowY="auto"
                  >
                    <CompareTemplateVersions
                      leftNameOverride={t(
                        'VersionAgentDialog.leftNameOverride',
                      )}
                      rightNameOverride={t(
                        'VersionAgentDialog.rightNameOverride',
                      )}
                      leftComparisonVersion="latest"
                      rightComparisonVersion="current"
                      defaultRightComparisonState={agentState as AgentState}
                      defaultLeftComparisonState={deployedAgentTemplate?.state}
                    />
                  </VStack>
                </VStack>
                <VStack
                  /* eslint-disable-next-line react/forbid-component-props */
                  className="max-w-[400px] w-[400px]"
                  borderLeft
                  fullHeight
                >
                  <FormFields isPending={isPending} />
                </VStack>
              </HStack>
            </HiddenOnMobile>
            <VisibleOnMobile checkWithJs>
              <VStack fullWidth collapseHeight flex>
                <VStack collapseHeight flex overflowY="auto" padding="small">
                  <CompareTemplateVersions
                    leftNameOverride={t('VersionAgentDialog.leftNameOverride')}
                    rightNameOverride={t(
                      'VersionAgentDialog.rightNameOverride',
                    )}
                    leftComparisonVersion="latest"
                    rightComparisonVersion="current"
                    defaultRightComparisonState={agentState as AgentState}
                    defaultLeftComparisonState={deployedAgentTemplate?.state}
                  />
                </VStack>
                <VStack>
                  <FormFields isPending={isPending} />
                </VStack>
              </VStack>
            </VisibleOnMobile>
          </VStack>
        </form>
      </MiniApp>
    </FormProvider>
  );
}

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

function OnboardingWrapper(props: OnboardingWrapperProps) {
  const { children } = props;
  const t = useTranslations('DeploymentButton');

  const show = useShowOnboarding('save_version');

  return (
    <OnboardingAsideFocus
      spotlight
      totalSteps={TOTAL_PRIMARY_ONBOARDING_STEPS}
      currentStep={4}
      title={t('OnboardingWrapper.title')}
      description={t('OnboardingWrapper.description')}
      placement="bottom-end"
      isOpen={show}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

function TemplateVersionDisplay() {
  // get latest template version
  const { deployedAgentTemplate, otherError } = useLatestAgentTemplate();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const [canUpdateTemplate] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  const show = useShowOnboarding('save_version');

  const versionNumber = deployedAgentTemplate?.version;
  if (otherError) {
    return (
      <Tooltip asChild content={t('DeploymentButton.errorTooltip')}>
        <Button
          size="default"
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
        size="default"
        color="primary"
        disabled
        label={t('DeploymentButton.readyToDeploy.trigger', {
          version: versionNumber,
        })}
      />
    );
  }

  return (
    <OnboardingWrapper>
      <CreateNewTemplateVersionDialog
        trigger={
          <Button
            size="default"
            _use_rarely_className={show ? 'shine' : ''}
            data-testid="stage-new-version-button"
            color="primary"
            fullWidth
            label={t('DeploymentButton.save')}
          />
        }
      />
    </OnboardingWrapper>
  );
}

export const isAgentConvertingToTemplateAtom = atom(false);

function CreateTemplateButton() {
  const { slug } = useCurrentProject();
  const { id: agentId } = useCurrentAgent();
  const setConvertingAtom = useSetAtom(isAgentConvertingToTemplateAtom);
  const { mutate, isPending, isSuccess } =
    cloudAPI.agents.createTemplateFromAgent.useMutation({
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
          size="default"
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

  if (isLocal) {
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
