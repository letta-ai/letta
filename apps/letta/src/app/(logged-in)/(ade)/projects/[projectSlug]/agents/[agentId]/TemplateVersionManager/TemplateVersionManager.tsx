import React, { useCallback, useMemo, useState } from 'react';
import type { PanelTemplate } from '@letta-web/component-library';
import { Alert, LettaLoader } from '@letta-web/component-library';
import { RawInput, Typography } from '@letta-web/component-library';
import {
  Badge,
  Button,
  Dialog,
  HStack,
  PanelBar,
  PanelMainContent,
  VStack,
} from '@letta-web/component-library';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$letta/client';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';
import { z } from 'zod';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';
import { useCurrentAgent } from '../hooks';
import { useTranslations } from 'next-intl';
import type { InfiniteGetProjectDeployedAgentTemplates200Response } from '$letta/web-api/projects/projectContracts';

function StageAndDeployDialog() {
  const { id: agentTemplateId } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const t = useTranslations('ADE/DeploymentAgentMangerPanel');

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
                        id: response.body.version,
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

  const handleVersionNewAgent = useCallback(() => {
    mutate({
      params: { agent_id: agentTemplateId },
    });
  }, [mutate, agentTemplateId]);

  return (
    <Dialog
      onOpenChange={setOpen}
      isOpen={open}
      testId="stage-agent-dialog"
      title={t('StageAndDeployDialog.title')}
      onConfirm={handleVersionNewAgent}
      isConfirmBusy={isPending}
      trigger={
        <Button
          data-testid="stage-new-version-button"
          color="primary"
          size="small"
          label={t('StageAndDeployDialog.trigger')}
        />
      }
    >
      <VStack gap="form">{t('StageAndDeployDialog.details')}</VStack>
    </Dialog>
  );
}

const PAGE_SIZE = 10;

interface DeployedAgentTemplateCardProps {
  version: string;
  index: number;
  createdAt: string;
}

function DeployedAgentTemplateCard(props: DeployedAgentTemplateCardProps) {
  const { version, index, createdAt } = props;
  const { slug: projectSlug, id: currentProjectId } = useCurrentProject();
  const { name } = useCurrentAgent();
  const [showDeploymentInstructions, setShowDeploymentInstructions] =
    React.useState(false);

  const t = useTranslations('ADE/DeploymentAgentMangerPanel');

  return (
    <VStack
      borderBottom
      color="background"
      paddingX="small"
      paddingTop="small"
      paddingBottom
      gap="large"
    >
      <HStack
        paddingBottom="small"
        borderBottom
        align="center"
        justify="spaceBetween"
      >
        <div>
          <Badge
            color="primary"
            content={t('DeployedAgentTemplateCard.release', { version })}
          />
        </div>
        <Typography color="muted">
          {t('DeployedAgentTemplateCard.createdAt', {
            date: nicelyFormattedDateAndTime(createdAt),
          })}
        </Typography>
      </HStack>
      <HStack>
        <RawInput
          fullWidth
          label={t('DeployedAgentTemplateCard.versionTag')}
          value={`${name}:${version}`}
          readOnly
          allowCopy
        />
      </HStack>
      <HStack>
        <HStack>
          <Button
            size="small"
            color="tertiary"
            onClick={() => {
              setShowDeploymentInstructions((v) => !v);
            }}
            active={showDeploymentInstructions}
            label={t('DeployedAgentTemplateCard.usageInstructions')}
            data-testid={`show-deployment-instructions-${index}`}
          />
          <Button
            color="tertiary"
            size="small"
            label={t('DeployedAgentTemplateCard.deployedAgents')}
            href={`/projects/${projectSlug}/agents?template=${name}:${version}`}
          />
        </HStack>
      </HStack>
      {showDeploymentInstructions && (
        <DeployAgentUsageInstructions
          versionKey={`${name}:${version}`}
          projectId={currentProjectId}
        />
      )}
    </VStack>
  );
}

function TemplateVersionManagerContent() {
  const { id: agentTemplateId } = useCurrentAgent();

  const { id: currentProjectId } = useCurrentProject();
  const { data, hasNextPage, fetchNextPage } =
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

  const t = useTranslations('ADE/DeploymentAgentMangerPanel');
  const deployedAgentTemplates = useMemo(() => {
    if (!data) {
      return null;
    }

    return (data?.pages || []).flatMap((v) => v.body.deployedAgentTemplates);
  }, [data]);

  if (!deployedAgentTemplates) {
    return <LettaLoader size={'large'} />;
  }

  if (deployedAgentTemplates.length === 0) {
    return <Alert title={t('emptyMessage')} variant="info" />;
  }

  return (
    <VStack>
      {deployedAgentTemplates.map((agent, index) => (
        <DeployedAgentTemplateCard
          {...agent}
          index={index}
          key={agent.version}
        />
      ))}
      {hasNextPage && (
        <Button
          label={t('loadMoreVersions')}
          onClick={() => {
            void fetchNextPage();
          }}
        />
      )}
    </VStack>
  );
}

export function TemplateVersionManager() {
  return (
    <VStack fullHeight gap={false}>
      <PanelBar actions={<StageAndDeployDialog />} />
      <PanelMainContent>
        <TemplateVersionManagerContent />
      </PanelMainContent>
    </VStack>
  );
}

export const deploymentPanelTemplate = {
  useGetTitle: () => {
    const t = useTranslations('ADE/TemplateVersionManager');

    return t('title');
  },
  data: z.undefined(),
  content: TemplateVersionManager,
  templateId: 'deployment',
} satisfies PanelTemplate<'deployment'>;
