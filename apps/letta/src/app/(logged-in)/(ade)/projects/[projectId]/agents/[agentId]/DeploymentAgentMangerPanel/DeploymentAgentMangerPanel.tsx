import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionCard,
  Badge,
  Button,
  Dialog,
  HStack,
  LoadingEmptyStatusComponent,
  Panel,
  PanelBar,
  PanelMainContent,
  VStack,
} from '@letta-web/component-library';
import { useCurrentTestingAgentId } from '../hooks';
import { useCurrentProjectId } from '../../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys } from '$letta/client';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';

function StageAndDeployDialog() {
  const testingAgentId = useCurrentTestingAgentId();
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } =
    webApi.projects.createProjectSourceAgentFromTestingAgent.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjectSourceAgents(projectId),
          exact: false,
        });

        setOpen(false);
      },
    });

  const handleCreateSourceAgent = useCallback(() => {
    mutate({
      body: { testingAgentId },
      params: { projectId },
    });
  }, [mutate, testingAgentId, projectId]);

  return (
    <Dialog
      onOpenChange={setOpen}
      isOpen={open}
      testId="stage-agent-dialog"
      title="Are you sure you want to stage your agent?"
      onSubmit={handleCreateSourceAgent}
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

interface SourceAgentCardProps {
  version: string;
  index: number;
  createdAt: string;
  agentKey: string;
  currentProjectId: string;
}

function SourceAgentCard(props: SourceAgentCardProps) {
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
          sourceAgentKey={agentKey}
          projectId={currentProjectId}
        />
      )}
    </ActionCard>
  );
}

export function DeploymentAgentMangerPanel() {
  const testingAgentId = useCurrentTestingAgentId();

  const currentProjectId = useCurrentProjectId();
  const [searchValue, setSearchValue] = useState('');
  const { data, hasNextPage, fetchNextPage } =
    webApi.projects.getProjectSourceAgents.useInfiniteQuery({
      queryKey: webApiQueryKeys.projects.getProjectSourceAgentsWithSearch(
        currentProjectId,
        {
          search: searchValue,
          testingAgentId: testingAgentId,
        }
      ),
      queryData: ({ pageParam }) => ({
        params: { projectId: currentProjectId },
        query: {
          testingAgentId,
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

  const sourceAgents = useMemo(() => {
    if (!data) {
      return null;
    }

    return (data?.pages || []).flatMap((v) => v.body.sourceAgents);
  }, [data]);

  return (
    <Panel
      title="Deployment Manager"
      id="staged-agents"
      trigger={
        <Button
          data-testid="open-deployment-manager"
          color="tertiary"
          size="small"
          label="Deployment Manager"
        />
      }
    >
      <PanelBar
        searchValue={searchValue}
        onSearch={setSearchValue}
        actions={<StageAndDeployDialog />}
      />
      <PanelMainContent>
        {!sourceAgents || sourceAgents.length === 0 ? (
          <LoadingEmptyStatusComponent
            isLoading={!sourceAgents}
            emptyMessage="You haven't staged this agent yet. Click the button above to deploy your agent template."
          />
        ) : (
          <VStack>
            {sourceAgents.map((agent, index) => (
              <SourceAgentCard
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
    </Panel>
  );
}
