import { useCurrentAgent } from '../hooks';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  ExternalLink,
  FormField,
  FormProvider,
  HStack,
  Popover,
  RocketIcon,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$letta/client';
import { CLOUD_UPSELL_URL } from '$letta/constants';
import { isAgentState } from '@letta-web/letta-agents-api';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentUser } from '$letta/client/hooks';
import { compareAgentStates } from '$letta/utils';
import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';

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
  const { name } = useCurrentAgent();
  const { id: agentTemplateId } = useCurrentAgent();
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
          ServerInferResponses<
            typeof contracts.agentTemplates.getAgentTemplateByVersion,
            200
          >
        >(
          {
            queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateByVersion(
              `${name}:latest`
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
          }
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
            color="secondary"
          />
        </VStack>
      </VStack>
    </Popover>
  );
}

interface UseHasDeployedAgentsArgs {
  deployedAgentTemplateId?: string;
}

function useHasDeployedAgents(args: UseHasDeployedAgentsArgs) {
  const { id: currentProjectId } = useCurrentProject();

  const { deployedAgentTemplateId = '' } = args;

  const { data: deployedAgents } = webApi.projects.getDeployedAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getDeployedAgentsWithSearch(
      currentProjectId,
      {
        deployedAgentTemplateId: deployedAgentTemplateId,
        limit: 1,
      }
    ),
    queryData: {
      params: {
        projectId: currentProjectId,
      },
      query: {
        deployedAgentTemplateId: deployedAgentTemplateId,
        limit: 1,
      },
    },
    refetchInterval: 5000,
    enabled: !!deployedAgentTemplateId,
  });

  return deployedAgents?.body.agents && deployedAgents.body.agents.length > 0;
}

function useLatestAgentTemplate() {
  const { name } = useCurrentAgent();

  const { data: deployedAgentTemplate } =
    webApi.agentTemplates.getAgentTemplateByVersion.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateByVersion(
        `${name}:latest`
      ),
      queryData: {
        params: { slug: `${name}:latest` },
      },
    });

  return deployedAgentTemplate?.body;
}

function TemplateVersionDisplay() {
  // get latest template version
  const agentState = useCurrentAgent();
  const deployedAgentTemplate = useLatestAgentTemplate();
  const { slug: projectSlug } = useCurrentProject();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const isAtLatestVersion = useMemo(() => {
    if (!deployedAgentTemplate?.state || !isAgentState(agentState)) {
      return true;
    }

    return compareAgentStates(agentState, deployedAgentTemplate.state);
  }, [deployedAgentTemplate, agentState]);

  const hasDeployedAgents = useHasDeployedAgents({
    deployedAgentTemplateId: deployedAgentTemplate?.id,
  });

  // TODO how to get versionNumber? 

  return (
    <Popover
      triggerAsChild
      trigger={
        <Button
          size="small"
          color="secondary"
          data-testid="version-template-trigger"
          label={
            isAtLatestVersion ? 
            (versionNumber ? t('DeploymentButton.readyToDeploy.trigger', { version: versionNumber }) : t('DeploymentButton.readyToDeploy.triggerNoVersion')) 
            : 
            (versionNumber ? t('DeploymentButton.updateAvailable.trigger', { version: versionNumber }) : t('DeploymentButton.updateAvailable.triggerNoVersion'))}
          preIcon={isAtLatestVersion ? <RocketIcon size="small" /> : <WarningIcon size="small" />}
        />
      }
      align="end"
    >
      <VStack padding="medium" gap="large">
        <VStack>
          {deployedAgentTemplate?.version && (
            <HStack>
              <Badge
                color="background-grey"
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
              : (versionNumber ? t('DeploymentButton.updateAvailable.copy', { version: versionNumber }) : t('DeploymentButton.updateAvailable.copyNoVersion'))}
          </Typography>
        </VStack>
        <VStack gap="small">
          {!isAtLatestVersion && <VersionAgentDialog />}
          <DeployAgentDialog isAtLatestVersion={isAtLatestVersion} />
          {hasDeployedAgents && (
            <Button
              fullWidth
              data-testid="view-deployed-agents"
              target="_blank"
              color="tertiary-transparent"
              label={t('VersionAgentDialog.deployedAgents')}
              href={`/projects/${projectSlug}/agents?template=${deployedAgentTemplate?.fullVersion}`}
            />
          )}
        </VStack>
      </VStack>
    </Popover>
  );
}

export function DeploymentButton() {
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
