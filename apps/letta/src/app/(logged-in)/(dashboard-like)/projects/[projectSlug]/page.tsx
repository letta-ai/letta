'use client';

import {
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
import { useTranslations } from 'next-intl';
import { AgentTemplateCard } from '$letta/client/components';

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
          // eslint-disable-next-line react/forbid-component-props
          <Skeleton key={index} className={TESTING_CARD_HEIGHT_CLASS} />
        ))}
      </VStack>
    );
  }

  if (agents.length === 0) {
    return (
      // eslint-disable-next-line react/forbid-component-props
      <VStack fullHeight fullWidth style={{ height: testingPageHeight }}>
        <DashboardEmptyArea
          message={t('agentTemplatesList.emptyMessage')}
          action={
            <Button
              preIcon={<PlusIcon />}
              data-testid="create-agent-template-button"
              label={t('agentTemplatesList.createAgentTemplate')}
              color="secondary"
              href={`/projects/${projectSlug}/templates/new`}
            />
          }
        />
      </VStack>
    );
  }

  return (
    <VStack fullWidth>
      {agents.map((agent) => (
        <AgentTemplateCard key={agent.id} agent={agent} />
      ))}
    </VStack>
  );
}

interface CreateAgentTemplateButtonProps {
  hideLabel?: boolean;
  projectSlug: string;
}

function CreateAgentTemplateButton(props: CreateAgentTemplateButtonProps) {
  const { projectSlug, hideLabel } = props;
  const t = useTranslations('projects/(projectSlug)/page');

  return (
    <Button
      label={t('agentTemplatesSection.createAgentTemplate')}
      data-testid="create-agent-template-button"
      preIcon={<PlusIcon />}
      color="tertiary"
      hideLabel={hideLabel}
      href={`/projects/${projectSlug}/templates/new`}
    />
  );
}

function AgentTemplatesSection() {
  const { id: currentProjectId, slug: projectSlug } = useCurrentProject();
  const { data } = webApi.agentTemplates.listAgentTemplates.useQuery({
    queryKey: webApiQueryKeys.agentTemplates.listAgentTemplatesWithSearch({
      search: '',
      projectId: currentProjectId,
      limit: RECENT_AGENTS_TO_DISPLAY + 1,
    }),
    queryData: {
      query: {
        projectId: currentProjectId,
        limit: RECENT_AGENTS_TO_DISPLAY + 1,
      },
    },
  });

  const t = useTranslations('projects/(projectSlug)/page');

  const agentCount = useMemo(
    () => data?.body.agentTemplates.length ?? 0,
    [data]
  );
  const agentsList = useMemo(
    () => data?.body.agentTemplates.slice(0, RECENT_AGENTS_TO_DISPLAY),
    [data]
  );

  return (
    <>
      <DashboardPageSection
        title={t('agentTemplatesSection.title')}
        actions={
          <>
            {/* This button should only be displayed if we have agents, otherwise we show an alert that asks them to do so instead */}
            {agentCount >= 1 && (
              <CreateAgentTemplateButton projectSlug={projectSlug} hideLabel />
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
