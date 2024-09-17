'use client';

import {
  ActionCard,
  Button,
  DashboardEmptyArea,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  HStack,
  PlusIcon,
  Skeleton,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useMemo } from 'react';
import { useCurrentProjectId } from './hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ProjectTestingAgentType } from '$letta/web-api/contracts/projects';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface StageAgentDialogProps {
  testingAgentId: string;
}

function StageAgentButton(props: StageAgentDialogProps) {
  const { testingAgentId } = props;
  const { push } = useRouter();
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const { mutate, isPending } =
    webApi.projects.createProjectSourceAgentFromTestingAgent.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjectSourceAgents(projectId),
        });

        push(`/projects/${projectId}/staging`);
      },
    });

  const handleCreateSourceAgent = useCallback(() => {
    mutate({ body: { testingAgentId }, params: { projectId } });
  }, [mutate, testingAgentId, projectId]);

  return (
    <Dialog
      title="Stage Agent"
      onConfirm={handleCreateSourceAgent}
      trigger={<Button label="Stage Agent" color="primary" />}
      confirmText="Stage Agent"
      isConfirmBusy={isPending}
    >
      This will stage the agent for deployment. Are you sure you want to
      proceed?
    </Dialog>
  );
}

interface TestingAgentCardProps {
  id: string;
  name: string;
}

function TestingAgentCard(props: TestingAgentCardProps) {
  const { id, name } = props;
  const projectId = useCurrentProjectId();
  return (
    <ActionCard
      title={name}
      mainAction={
        <HStack>
          <Button
            href={`/projects/${projectId}/agents/${id}`}
            color="tertiary"
            label="View / Edit Agent"
          />
          <StageAgentButton testingAgentId={id} />
        </HStack>
      }
    />
  );
}

interface TestingAgentsListProps {
  agents?: ProjectTestingAgentType[];
}

const RECENT_AGENTS_TO_DISPLAY = 3;
const TESTING_CARD_HEIGHT = '62px';
const TESTING_CARD_HEIGHT_CLASS = 'h-[62px]';
const testingPageHeight = `calc((var(--default-gap) * 2) + (${TESTING_CARD_HEIGHT} * ${RECENT_AGENTS_TO_DISPLAY}))`;

function TestingAgentsList(props: TestingAgentsListProps) {
  const currentProjectId = useCurrentProjectId();
  const { agents } = props;

  if (!agents) {
    return (
      <VStack fullHeight fullWidth>
        {new Array(RECENT_AGENTS_TO_DISPLAY).fill(null).map((_u, index) => (
          <Skeleton key={index} className={TESTING_CARD_HEIGHT_CLASS} />
        ))}
      </VStack>
    );
  }

  if (agents.length === 0) {
    return (
      <VStack fullHeight fullWidth style={{ height: testingPageHeight }}>
        <DashboardEmptyArea
          message="You have no agents in this project"
          action={
            <Button
              preIcon={<PlusIcon />}
              label="Create an agent"
              color="secondary"
              href={`/projects/${currentProjectId}/agents/new`}
            />
          }
        />
      </VStack>
    );
  }

  return (
    <VStack fullWidth>
      {agents.map((agent) => (
        <TestingAgentCard key={agent.id} id={agent.id} name={agent.name} />
      ))}
    </VStack>
  );
}

function TestingAgentsSection() {
  const currentProjectId = useCurrentProjectId();
  const { data } = webApi.projects.getProjectTestingAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectTestingAgentsWithSearch(
      currentProjectId,
      { search: '', limit: RECENT_AGENTS_TO_DISPLAY + 1 }
    ),
    queryData: {
      params: {
        projectId: currentProjectId,
      },
    },
  });

  const agentCount = useMemo(() => data?.body.length ?? 0, [data]);
  const agentsList = useMemo(
    () => data?.body.slice(0, RECENT_AGENTS_TO_DISPLAY),
    [data]
  );

  return (
    <>
      {/*{agentCount === 0 && (*/}
      {/*  <Alert*/}
      {/*    title="You have no testing agents in this project"*/}
      {/*    action={<Button size="small" postIcon={<ArrowRightIcon />} label="Create a testing agent" color="secondary" href={`/projects/${currentProjectId}/agents/new`} />}*/}
      {/*  />*/}
      {/*)}*/}
      <DashboardPageSection
        title="Recent Agents"
        actions={
          <>
            {agentCount > RECENT_AGENTS_TO_DISPLAY + 1 && (
              <Button
                size="small"
                label="See all agents"
                color="tertiary"
                href={`/projects/${currentProjectId}/agents`}
              />
            )}
            {/* This button should only be displayed if we have agents, otherwise we show an alert that asks them to do so instead */}
            {agentCount >= 1 && (
              <Button
                label="Create an agent"
                preIcon={<PlusIcon />}
                color="tertiary"
                href={`/projects/${currentProjectId}/agents/new`}
              />
            )}
          </>
        }
      >
        <HStack fullWidth>
          <TestingAgentsList agents={agentsList} />
        </HStack>
      </DashboardPageSection>
    </>
  );
}

function ProjectPage() {
  return (
    <DashboardPageLayout title="Project Home">
      <TestingAgentsSection />
    </DashboardPageLayout>
  );
}

export default ProjectPage;
