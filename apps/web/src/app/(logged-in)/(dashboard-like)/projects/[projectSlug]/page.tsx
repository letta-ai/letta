'use client';

import {
  Avatar,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  LettaInvaderOutlineIcon,
  NiceGridDisplay,
  PlusIcon,
  TemplateIcon,
  VStack,
} from '@letta-web/component-library';
import React, { useMemo } from 'react';
import { useCurrentProject } from './hooks';
import { webApi, webApiQueryKeys } from '$web/client';
import type { ProjectAgentTemplateType } from '$web/web-api/contracts';
import { useTranslations } from 'next-intl';
import { DashboardCard, Tutorials } from '$web/client/components';
import { useWelcomeText } from '$web/client/hooks/useWelcomeText/useWelcomeText';
import { CreateNewTemplateDialog } from './_components/CreateNewTemplateDialog/CreateNewTemplateDialog';
import { useDateFormatter } from '@letta-web/helpful-client-utils';

interface AgentTemplatesListProps {
  agents?: ProjectAgentTemplateType[];
}

const RECENT_AGENTS_TO_DISPLAY = 3;

function AgentTemplatesList(props: AgentTemplatesListProps) {
  const { agents } = props;
  const t = useTranslations('projects/(projectSlug)/page');
  const { slug: projectSlug } = useCurrentProject();

  const { formatDateAndTime } = useDateFormatter();

  if (!agents) {
    return (
      <NiceGridDisplay itemHeight="112px" itemWidth="318px">
        {new Array(RECENT_AGENTS_TO_DISPLAY).fill(null).map((_u, index) => (
          <DashboardCard title="" key={index} isSkeleton />
        ))}
      </NiceGridDisplay>
    );
  }

  return (
    <NiceGridDisplay itemHeight="112px" itemWidth="318px">
      {agents.map((agent) => (
        <DashboardCard
          href={`/projects/${projectSlug}/templates/${agent.name}`}
          largeImage={
            <Avatar size="xxlarge" name={agent.name.replace('-', ' ')} />
          }
          description={t('agentTemplatesList.updatedAt', {
            date: formatDateAndTime(agent.updatedAt),
          })}
          title={agent.name}
          key={agent.id}
        />
      ))}
    </NiceGridDisplay>
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

  const agentsList = useMemo(
    () => data?.body.agentTemplates.slice(0, RECENT_AGENTS_TO_DISPLAY),
    [data]
  );

  if (agentsList && agentsList.length === 0) {
    return null;
  }

  return (
    <>
      <DashboardPageSection
        title={t('agentTemplatesSection.title')}
        description={t('agentTemplatesSection.subtitle')}
      >
        <HStack fullWidth>
          <AgentTemplatesList agents={agentsList} />
        </HStack>
      </DashboardPageSection>
    </>
  );
}

function QuickActions() {
  const t = useTranslations('projects/(projectSlug)/page');
  const { slug: projectSlug } = useCurrentProject();

  return (
    <DashboardPageSection
      title={t('QuickActions.title')}
      description={t('QuickActions.subtitle')}
    >
      <NiceGridDisplay itemWidth="318px" itemHeight="112px">
        <DashboardCard
          href={`/projects/${projectSlug}/agents`}
          largeImage={
            <VStack
              fullHeight
              fullWidth
              align="center"
              justify="center"
              color="background-grey"
            >
              <LettaInvaderOutlineIcon color="primary" size="xxlarge" />
            </VStack>
          }
          title={t('QuickActions.monitorAgents.title')}
          description={t('QuickActions.monitorAgents.description')}
        />
        <DashboardCard
          href={`/projects/${projectSlug}/templates`}
          largeImage={
            <VStack
              fullHeight
              fullWidth
              align="center"
              justify="center"
              color="background-grey"
            >
              <TemplateIcon color="primary" size="xxlarge" />
            </VStack>
          }
          title={t('QuickActions.viewTemplates.title')}
          description={t('QuickActions.viewTemplates.description')}
        />
        <CreateNewTemplateDialog
          trigger={
            <DashboardCard
              testId="create-agent-template-button"
              largeImage={
                <VStack
                  fullHeight
                  fullWidth
                  align="center"
                  justify="center"
                  color="background-grey"
                >
                  <PlusIcon color="primary" size="xxlarge" />
                </VStack>
              }
              title={t('QuickActions.createTemplate.title')}
              description={t('QuickActions.createTemplate.description')}
            />
          }
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
      <QuickActions />
      <Tutorials />
    </DashboardPageLayout>
  );
}

export default ProjectPage;
