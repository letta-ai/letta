'use client';

import {
  Button,
  CTACard,
  DashboardEmptyArea,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  NiceGridDisplay,
  PlusIcon,
  SearchIcon,
  Skeleton,
  TabGroupIcon,
  VStack,
} from '@letta-web/component-library';
import React, { useMemo } from 'react';
import { useCurrentProject } from './hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ProjectAgentTemplateType } from '$letta/web-api/contracts';
import { useTranslations } from 'next-intl';
import { AgentTemplateCard, Tutorials } from '$letta/client/components';
import { useWelcomeText } from '$letta/client/hooks/useWelcomeText/useWelcomeText';
import { CreateNewTemplateDialog } from './_components/CreateNewTemplateDialog/CreateNewTemplateDialog';

interface AgentTemplatesListProps {
  agents?: ProjectAgentTemplateType[];
}

const RECENT_AGENTS_TO_DISPLAY = 3;
const TESTING_CARD_HEIGHT = '62px';
const TESTING_CARD_HEIGHT_CLASS = 'h-[62px]';
const testingPageHeight = `calc((var(--default-gap) * 2) + (${TESTING_CARD_HEIGHT} * ${RECENT_AGENTS_TO_DISPLAY}))`;

function AgentTemplatesList(props: AgentTemplatesListProps) {
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
            <CreateNewTemplateDialog
              trigger={
                <Button
                  preIcon={<PlusIcon />}
                  data-testid="create-agent-template-button"
                  label={t('agentTemplatesList.createAgentTemplate')}
                  color="secondary"
                />
              }
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

function CreateAgentTemplateButton() {
  const t = useTranslations('projects/(projectSlug)/page');

  return (
    <CreateNewTemplateDialog
      trigger={
        <Button
          label={t('agentTemplatesSection.createAgentTemplate')}
          data-testid="create-agent-template-button"
          preIcon={<PlusIcon />}
          color="tertiary"
        />
      }
    />
  );
}

function AgentTemplatesSection() {
  const { id: currentProjectId } = useCurrentProject();
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
            {agentCount >= 1 && <CreateAgentTemplateButton />}
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function QuickActions() {
  const t = useTranslations('projects/(projectSlug)/page');

  return (
    <DashboardPageSection
      title={t('QuickActions.title')}
      description={t('QuickActions.subtitle')}
    >
      <NiceGridDisplay itemWidth="252px" itemHeight="252px">
        <CTACard
          action={
            <Button
              href="/development-servers/local/agents/new"
              label={t('QuickActions.createTemplate.cta')}
              color="secondary"
            />
          }
          icon={<TabGroupIcon />}
          title={t('QuickActions.createTemplate.title')}
          subtitle={t('QuickActions.createTemplate.description')}
        />
        <CTACard
          action={
            <Button
              href="/development-servers/local/agents"
              label={t('QuickActions.monitorAgents.cta')}
              color="secondary"
            />
          }
          icon={<SearchIcon />}
          title={t('QuickActions.monitorAgents.title')}
          subtitle={t('QuickActions.monitorAgents.description')}
        />
      </NiceGridDisplay>
    </DashboardPageSection>
  );
}

function ProjectPage() {
  const t = useTranslations('projects/(projectSlug)/page');
  const { name } = useCurrentProject();

  const welcomeText = useWelcomeText();

  return (
    <DashboardPageLayout
      cappedWidth
      title={welcomeText || ''}
      subtitle={t('subtitle', { name })}
    >
      <AgentTemplatesSection />
      <Tutorials />
    </DashboardPageLayout>
  );
}

export default ProjectPage;
