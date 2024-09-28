'use client';

import {
  ActionCard,
  Button,
  DashboardEmptyArea,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  PlusIcon,
  Skeleton,
  VStack,
} from '@letta-web/component-library';
import React, { useMemo } from 'react';
import { useCurrentProjectId } from './hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ProjectAgentTemplateType } from '$letta/web-api/contracts';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';

interface AgentTemplateCardProps {
  id: string;
  name: string;
  lastUpdatedAt: string;
}

function AgentTemplateCard(props: AgentTemplateCardProps) {
  const { id, name, lastUpdatedAt } = props;
  const projectId = useCurrentProjectId();

  return (
    <ActionCard
      title={name}
      subtitle={`Last updated ${nicelyFormattedDateAndTime(lastUpdatedAt)}`}
      mainAction={
        <HStack>
          <Button
            href={`/projects/${projectId}/agents/${id}`}
            color="secondary"
            label="Open in ADE"
          />
        </HStack>
      }
    ></ActionCard>
  );
}

interface AgentTemplatesListProps {
  agents?: ProjectAgentTemplateType[];
}

const RECENT_AGENTS_TO_DISPLAY = 3;
const TESTING_CARD_HEIGHT = '62px';
const TESTING_CARD_HEIGHT_CLASS = 'h-[62px]';
const testingPageHeight = `calc((var(--default-gap) * 2) + (${TESTING_CARD_HEIGHT} * ${RECENT_AGENTS_TO_DISPLAY}))`;

function AgentTemplatesList(props: AgentTemplatesListProps) {
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
              data-testid="create-agent-template-button"
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
        <AgentTemplateCard
          key={agent.id}
          id={agent.id}
          name={agent.name}
          lastUpdatedAt={agent.updatedAt}
        />
      ))}
    </VStack>
  );
}

function AgentTemplatesSection() {
  const currentProjectId = useCurrentProjectId();
  const { data } = webApi.projects.getProjectAgentTemplates.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectAgentTemplatesWithSearch(
      currentProjectId,
      { search: '', limit: RECENT_AGENTS_TO_DISPLAY + 1 }
    ),
    queryData: {
      query: {
        orderBy: 'createdAt',
        orderDirection: 'desc',
      },
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
        title="Recent Agent Templates"
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
                label="Create an agent template"
                data-testid="create-agent-template-button"
                preIcon={<PlusIcon />}
                color="tertiary"
                href={`/projects/${currentProjectId}/agents/new`}
              />
            )}
          </>
        }
      >
        <HStack fullWidth>
          <AgentTemplatesList agents={agentsList} />
        </HStack>
      </DashboardPageSection>
    </>
  );
}

function ProjectPage() {
  return (
    <DashboardPageLayout title="Project Home">
      <AgentTemplatesSection />
    </DashboardPageLayout>
  );
}

export default ProjectPage;
