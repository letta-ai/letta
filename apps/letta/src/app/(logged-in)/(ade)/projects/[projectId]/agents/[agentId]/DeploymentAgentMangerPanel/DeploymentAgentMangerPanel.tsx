import React, { useCallback, useMemo, useState } from 'react';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  ActionCard,
  Badge,
  Button,
  Dialog,
  HStack,
  LoadingEmptyStatusComponent,
  PanelBar,
  PanelMainContent,
  VStack,
} from '@letta-web/component-library';
import { useCurrentAgentId } from '../hooks';
import { useCurrentProjectId } from '../../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys } from '$letta/client';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';
import { z } from 'zod';

function StageAndDeployDialog() {
  const agentTemplateId = useCurrentAgentId();
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } =
    webApi.projects.createProjectDeployedAgentTemplateFromAgentTemplate.useMutation(
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey:
              webApiQueryKeys.projects.getProjectDeployedAgentTemplates(
                projectId
              ),
            exact: false,
          });

          setOpen(false);
        },
      }
    );

  const handleCreateDeployedAgentTemplate = useCallback(() => {
    mutate({
      body: { agentTemplateId },
      params: { projectId },
    });
  }, [mutate, agentTemplateId, projectId]);

  return (
    <Dialog
      onOpenChange={setOpen}
      isOpen={open}
      testId="stage-agent-dialog"
      title="Are you sure you want to stage your agent?"
      onSubmit={handleCreateDeployedAgentTemplate}
      isConfirmBusy={isPending}
      trigger={
        <Button
          data-testid="stage-new-version-button"
          color="secondary"
          size="small"
          label="Stage a new version"
        />
      }
    >
      <VStack gap="form">
        This will allow your agent to be deployed to the cloud and used in
        production. Are you sure you want to stage your agent?
      </VStack>
    </Dialog>
  );
}

const PAGE_SIZE = 10;

interface DeployedAgentTemplateCardProps {
  version: string;
  index: number;
  createdAt: string;
  agentKey: string;
  currentProjectId: string;
}

function DeployedAgentTemplateCard(props: DeployedAgentTemplateCardProps) {
  const { version, createdAt, index, agentKey, currentProjectId } = props;
  const [showDeploymentInstructions, setShowDeploymentInstructions] =
    React.useState(false);

  return (
    <ActionCard
      mainAction={
        <HStack>
          <Button
            size="small"
            color="tertiary"
            onClick={() => {
              setShowDeploymentInstructions((v) => !v);
            }}
            active={showDeploymentInstructions}
            label="Instructions"
            data-testid={`show-deployment-instructions-${index}`}
          />
          <Button
            target="_blank"
            color="tertiary"
            size="small"
            label="Agents"
            href={`/projects/${currentProjectId}/deployments?stagingAgentKey=${agentKey}`}
          />
        </HStack>
      }
      title={agentKey}
      subtitle={`Staged at ${createdAt}`}
      icon={<Badge content={`v${version}`} />}
    >
      {showDeploymentInstructions && (
        <DeployAgentUsageInstructions
          deployedAgentTemplateKey={agentKey}
          projectId={currentProjectId}
        />
      )}
    </ActionCard>
  );
}

export function DeploymentAgentMangerPanel() {
  const agentTemplateId = useCurrentAgentId();

  const currentProjectId = useCurrentProjectId();
  const [searchValue, setSearchValue] = useState('');
  const { data, hasNextPage, fetchNextPage } =
    webApi.projects.getProjectDeployedAgentTemplates.useInfiniteQuery({
      queryKey:
        webApiQueryKeys.projects.getProjectDeployedAgentTemplatesWithSearch(
          currentProjectId,
          {
            search: searchValue,
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

  const deployedAgentTemplates = useMemo(() => {
    if (!data) {
      return null;
    }

    return (data?.pages || []).flatMap((v) => v.body.deployedAgentTemplates);
  }, [data]);

  return (
    <VStack gap={false}>
      <PanelBar
        searchValue={searchValue}
        onSearch={setSearchValue}
        actions={<StageAndDeployDialog />}
      />
      <PanelMainContent>
        {!deployedAgentTemplates || deployedAgentTemplates.length === 0 ? (
          <LoadingEmptyStatusComponent
            isLoading={!deployedAgentTemplates}
            emptyMessage="You haven't staged this agent yet. Click the button above to deploy your agent template."
          />
        ) : (
          <VStack>
            {deployedAgentTemplates.map((agent, index) => (
              <DeployedAgentTemplateCard
                {...agent}
                index={index}
                key={agent.key}
                agentKey={agent.key}
                currentProjectId={currentProjectId}
              />
            ))}
            {hasNextPage && (
              <Button
                label="Load more agents"
                onClick={() => {
                  void fetchNextPage();
                }}
              />
            )}
          </VStack>
        )}
      </PanelMainContent>
    </VStack>
  );
}

export const deploymentPanelTemplate = {
  title: 'Deployment',
  data: z.undefined(),
  content: DeploymentAgentMangerPanel,
  templateId: 'deployment',
} satisfies PanelTemplate<'deployment'>;
