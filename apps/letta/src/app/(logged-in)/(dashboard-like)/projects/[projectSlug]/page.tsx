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
import { useCurrentProject } from './hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ProjectAgentTemplateType } from '$letta/web-api/contracts';
import { nicelyFormattedDateAndTime } from '@letta-web/helpful-client-utils';
import { useTranslations } from 'next-intl';

interface AgentTemplateCardProps {
  id: string;
  name: string;
  lastUpdatedAt: string;
}

function AgentTemplateCard(props: AgentTemplateCardProps) {
  const t = useTranslations('projects/(projectSlug)/page');
  const { name, lastUpdatedAt } = props;
  const { slug: projectSlug } = useCurrentProject();

  return (
    <ActionCard
      title={name}
      subtitle={t('agentTemplateCard.subtitle', {
        date: nicelyFormattedDateAndTime(lastUpdatedAt),
      })}
      mainAction={
        <HStack>
          <Button
            href={`/projects/${projectSlug}/agents/${name}`}
            color="secondary"
            label={t('agentTemplateCard.openInADE')}
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
  const { slug: projectSlug } = useCurrentProject();
  const { agents } = props;
  const t = useTranslations('projects/(projectSlug)/page');

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
          message={t('agentTemplatesList.emptyMessage')}
          action={
            <Button
              preIcon={<PlusIcon />}
              data-testid="create-agent-template-button"
              label={t('agentTemplatesList.createAgentTemplate')}
              color="secondary"
              href={`/projects/${projectSlug}/agents/new`}
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
  const { id: currentProjectId, slug: projectSlug } = useCurrentProject();
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

  const t = useTranslations('projects/(projectSlug)/page');

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
        title={t('agentTemplatesSection.title')}
        actions={
          <>
            {/* This button should only be displayed if we have agents, otherwise we show an alert that asks them to do so instead */}
            {agentCount >= 1 && (
              <Button
                label={t('agentTemplatesSection.createAgentTemplate')}
                data-testid="create-agent-template-button"
                preIcon={<PlusIcon />}
                color="tertiary"
                href={`/projects/${projectSlug}/agents/new`}
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
  const t = useTranslations('projects/(projectSlug)/page');
  return (
    <DashboardPageLayout title={t('title')}>
      <AgentTemplatesSection />
    </DashboardPageLayout>
  );
}

export default ProjectPage;
