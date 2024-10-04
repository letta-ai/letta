import React, { useCallback, useMemo, useState } from 'react';
import type { PanelTemplate } from '@letta-web/component-library';
import { Card, RawInput, Typography } from '@letta-web/component-library';
import {
  Badge,
  Button,
  Dialog,
  HStack,
  LoadingEmptyStatusComponent,
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

function StageAndDeployDialog() {
  const { id: agentTemplateId } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } =
    webOriginSDKApi.agents.versionAgentTemplate.useMutation({
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
      title="Are you sure you want to version your agent?"
      onConfirm={handleVersionNewAgent}
      isConfirmBusy={isPending}
      trigger={
        <Button
          data-testid="stage-new-version-button"
          color="secondary"
          size="small"
          label="Create a new version"
        />
      }
    >
      <VStack gap="form">
        This creates a version of your agent template that is immutable and can
        be used to deploy agents. Are you sure you want to proceed?
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
}

function DeployedAgentTemplateCard(props: DeployedAgentTemplateCardProps) {
  const { version, index, agentKey, createdAt } = props;
  const { slug: projectSlug, id: currentProjectId } = useCurrentProject();
  const { name } = useCurrentAgent();
  const [showDeploymentInstructions, setShowDeploymentInstructions] =
    React.useState(false);

  return (
    <Card>
      <VStack gap="large">
        <HStack
          paddingBottom="small"
          borderBottom
          align="center"
          justify="spaceBetween"
        >
          <div>
            <Badge color="primary" content={`Release #${version}`} />
          </div>
          <Typography color="muted">
            Created at {nicelyFormattedDateAndTime(createdAt)}
          </Typography>
        </HStack>
        <HStack>
          <RawInput
            fullWidth
            label="Version Tag"
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
              label="Usage Instructions"
              data-testid={`show-deployment-instructions-${index}`}
            />
            <Button
              target="_blank"
              color="tertiary"
              size="small"
              label="Deployed Agents"
              href={`/projects/${projectSlug}/deployments?stagingAgentKey=${agentKey}`}
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
    </Card>
  );
}

export function DeploymentAgentMangerPanel() {
  const { id: agentTemplateId } = useCurrentAgent();

  const { id: currentProjectId } = useCurrentProject();
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
    <VStack fullHeight gap={false}>
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
                key={agent.id}
                agentKey={agent.id}
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
  title: 'Version Manager',
  data: z.undefined(),
  content: DeploymentAgentMangerPanel,
  templateId: 'deployment',
} satisfies PanelTemplate<'deployment'>;
