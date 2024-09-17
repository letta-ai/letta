import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionCard,
  Button,
  Dialog,
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
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/deploy-agent-reference';

function StageAndDeployDialog() {
  const testingAgentId = useCurrentTestingAgentId();
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();

  const [sourceAgentId, setSourceAgentId] = useState<string>();
  const { mutate, isPending } =
    webApi.projects.createProjectSourceAgentFromTestingAgent.useMutation({
      onSuccess: (response) => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjectSourceAgents(projectId),
        });

        setSourceAgentId(response.body.id);
      },
    });

  const handleCreateSourceAgent = useCallback(() => {
    mutate({ body: { testingAgentId }, params: { projectId } });
  }, [mutate, testingAgentId, projectId]);

  if (sourceAgentId) {
    return (
      <Dialog
        size="large"
        title="Congratulations! Your agent has been staged."
        hideConfirm
        onOpenChange={(open) => {
          if (!open) {
            setSourceAgentId(undefined);
          }
        }}
      >
        <DeployAgentUsageInstructions
          sourceAgentId={sourceAgentId}
          projectId={projectId}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Are you sure you want to stage your agent?"
      onConfirm={handleCreateSourceAgent}
      isConfirmBusy={isPending}
      trigger={
        <Button color="secondary" size="small" label="Stage a new version" />
      }
    >
      This will allow your agent to be deployed to the cloud and used in
      production. Are you sure you want to stage your agent?
    </Dialog>
  );
}

const PAGE_SIZE = 10;

export function StagedAgentsPanel() {
  const testingAgentId = useCurrentTestingAgentId();
  const currentProjectId = useCurrentProjectId();
  const [searchValue, setSearchValue] = useState('');
  const { data, hasNextPage, fetchNextPage } =
    webApi.projects.getProjectSourceAgents.useInfiniteQuery({
      queryKey: webApiQueryKeys.projects.getProjectTestingAgentsWithSearch(
        currentProjectId,
        {
          search: searchValue,
          testingAgentId: testingAgentId,
        }
      ),
      queryData: ({ pageParam }) => ({
        params: { projectId: currentProjectId },
        query: {
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
      title="Staging Manager"
      id="staged-agents"
      trigger={<Button color="tertiary" size="small" label="Staging Manager" />}
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
            emptyMessage="You haven't staged this agent yet. Click the button below to stage your agent."
            emptyAction={<StageAndDeployDialog />}
          />
        ) : (
          <VStack>
            {sourceAgents.map((agent) => (
              <ActionCard
                mainAction={
                  <Button
                    target="_blank"
                    color="tertiary"
                    size="small"
                    label="View Deployed Agents"
                    href={`/projects/${currentProjectId}/deployments?stagingAgentId=${agent.id}&stagingAgentName=${agent.name}`}
                  />
                }
                title={agent.name}
                subtitle={`Staged at ${agent.createdAt}`}
                key={agent.id}
                icon={
                  <div className="text-xs bg-background-grey rounded-full px-4 py-1">
                    v{agent.version}
                  </div>
                }
              ></ActionCard>
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
