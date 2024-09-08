'use client';

import {
  ActionCard,
  Button,
  Card,
  DashboardEmptyArea,
  DashboardPageSection,
  HStack,
  PlusIcon,
  Skeleton,
  Typography,
  VStack,
} from '@letta-web/component-library';
import React, { useMemo } from 'react';
import { useCurrentProject, useCurrentProjectId } from './hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ProjectTestingAgentType } from '$letta/any/contracts/projects';

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
          <Button
            href={`/projects/${projectId}/agents/${id}/deploy`}
            color="primary"
            label="Deploy Agent"
          />
        </HStack>
      }
    />
  );
}

interface DeployedAgentCardProps {
  status: 'live' | 'offline';
  name: string;
  id: string;
  deployedAt: Date;
}

function DeployedAgentCard(props: DeployedAgentCardProps) {
  const { status, name, deployedAt, id } = props;
  const projectId = useCurrentProjectId();
  return (
    <Card>
      <HStack justify="spaceBetween">
        <HStack gap="medium" align="center">
          <div
            className={`rounded-full bg-${
              status === 'live' ? 'green' : 'red'
            }-400 w-[10px] h-[10px]`}
          />
          <VStack gap={false} justify="start">
            <Typography align="left" bold>
              {name}
            </Typography>
            <Typography color="muted" variant="body2">
              Deployed {deployedAt.toDateString()}
            </Typography>
          </VStack>
        </HStack>
        <HStack align="center">
          <Button
            href={`/projects/${projectId}/agents/${id}/deploy`}
            color="tertiary"
            label="See Deployment"
          />
        </HStack>
      </HStack>
    </Card>
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
              size="small"
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
                size="small"
                label="Create an agent"
                preIcon={<PlusIcon />}
                color="secondary"
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
  const { name } = useCurrentProject();

  return (
    <>
      <TestingAgentsSection />
    </>
  );
}

export default ProjectPage;
