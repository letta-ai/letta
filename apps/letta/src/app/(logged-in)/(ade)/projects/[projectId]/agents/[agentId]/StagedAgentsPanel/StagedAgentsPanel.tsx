import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionCard,
  Badge,
  Button,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  LoadingEmptyStatusComponent,
  Panel,
  PanelBar,
  PanelMainContent,
  Switch,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { useCurrentTestingAgentId } from '../hooks';
import { useCurrentProjectId } from '../../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys } from '$letta/client';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';

interface StageAndDeployDialogProps {
  hasExistingStagedAgents?: boolean;
}

const StageAndDeployFormSchema = z.object({
  migrateExistingAgents: z.boolean(),
});

function StageAndDeployDialog(props: StageAndDeployDialogProps) {
  const { hasExistingStagedAgents } = props;
  const testingAgentId = useCurrentTestingAgentId();
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(StageAndDeployFormSchema),
    defaultValues: {
      migrateExistingAgents: false,
    },
  });

  const { mutate, isPending } =
    webApi.projects.createProjectSourceAgentFromTestingAgent.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjectSourceAgents(projectId),
          exact: false,
        });

        setOpen(false);
        form.reset();
      },
    });

  const handleCreateSourceAgent = useCallback(
    (values: z.infer<typeof StageAndDeployFormSchema>) => {
      const { migrateExistingAgents } = values;

      mutate({
        body: { testingAgentId, migrateExistingAgents },
        params: { projectId },
      });
    },
    [mutate, testingAgentId, projectId]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={setOpen}
        isOpen={open}
        title="Are you sure you want to stage your agent?"
        onSubmit={form.handleSubmit(handleCreateSourceAgent)}
        isConfirmBusy={isPending}
        trigger={
          <Button color="secondary" size="small" label="Stage a new version" />
        }
      >
        <VStack gap="form">
          {hasExistingStagedAgents && (
            <HStack border padding="small" rounded>
              <FormField
                name="migrateExistingAgents"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    description="This will migrate your previous deployed agents to the new version automatically. Your migrated agents will forget all the core memory updates. Please use this option with caution."
                    {...field}
                    label="Migrate existing deployed agents"
                  />
                )}
              />
            </HStack>
          )}
          This will allow your agent to be deployed to the cloud and used in
          production. Are you sure you want to stage your agent?
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

const PAGE_SIZE = 10;

interface SourceAgentCardProps {
  version: string;
  createdAt: string;
  agentKey: string;
  currentProjectId: string;
}

function SourceAgentCard(props: SourceAgentCardProps) {
  const { version, createdAt, agentKey, currentProjectId } = props;
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
          />
          <Button
            target="_blank"
            color="tertiary"
            size="small"
            label="Deployed Agents"
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

export function StagedAgentsPanel() {
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
      title="Staging Manager"
      id="staged-agents"
      trigger={<Button color="tertiary" size="small" label="Staging Manager" />}
    >
      <PanelBar
        searchValue={searchValue}
        onSearch={setSearchValue}
        actions={
          <StageAndDeployDialog
            hasExistingStagedAgents={
              !!(sourceAgents && sourceAgents.length >= 1)
            }
          />
        }
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
              <SourceAgentCard
                {...agent}
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
