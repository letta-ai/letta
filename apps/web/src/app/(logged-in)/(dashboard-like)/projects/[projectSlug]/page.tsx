'use client';

import {
  BoxList,
  Button,
  ChevronRightIcon,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  LettaInvaderIcon,
  PlusIcon,
  TemplateIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useMemo } from 'react';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';
import { Tutorials } from '$web/client/components';
import { useWelcomeText } from '$web/client/hooks/useWelcomeText/useWelcomeText';
import { CreateNewTemplateDialog } from './_components/CreateNewTemplateDialog/CreateNewTemplateDialog';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useAgentsServiceListAgents } from '@letta-cloud/sdk-core';
import { useFormatters } from '@letta-cloud/utils-client';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';

function RecentAgentsSection() {
  const { slug, id } = useCurrentProject();
  const { data: agents } = useAgentsServiceListAgents(
    {
      limit: 3,
      projectId: id,
    },
    undefined,
    {
      retry: false,
    },
  );

  const { formatDate } = useFormatters();
  const t = useTranslations('projects/(projectSlug)/page');

  return (
    <BoxList
      icon={<LettaInvaderIcon />}
      title={t('RecentAgentsSection.title')}
      items={(agents || []).map((agent) => ({
        title: agent.name,
        description: t('RecentAgentsSection.createdAt', {
          date: formatDate(agent.updated_at || ''),
        }),
        action: (
          <Button
            color="secondary"
            label={t('RecentAgentsSection.viewAgent')}
            size="small"
            href={`/projects/${slug}/agents/${agent.id}`}
          />
        ),
      }))}
      loadingConfig={{
        isLoading: !agents,
        rowsToDisplay: 3,
      }}
      emptyConfig={{
        icon: <LettaInvaderIcon />,
        title: t('RecentAgentsSection.emptyState.title'),
        description: t('RecentAgentsSection.emptyState.description'),
        action: (
          <Button
            bold
            disabled
            label={t('RecentAgentsSection.noAgents')}
            color="secondary"
          />
        ),
      }}
      bottomAction={
        <Button
          label={t('RecentAgentsSection.viewAllAgents')}
          size="small"
          color="tertiary"
          href={`/projects/${slug}/agents`}
          postIcon={<ChevronRightIcon />}
        />
      }
    />
  );
}

function RecentTemplatesSection() {
  const { id: currentProjectId, slug } = useCurrentProject();
  const { data } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesProjectScopedWithSearch(currentProjectId, {
      search: '',
      limit: 3,
    }),
    queryData: {
      query: {
        project_id: currentProjectId,
        limit: '3',
      },
    },
  });

  const [canCRDTemplates] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  const t = useTranslations('projects/(projectSlug)/page');

  const templatesList = useMemo(() => data?.body.templates || [], [data]);

  return (
    <BoxList
      icon={<TemplateIcon />}
      title={t('RecentTemplatesSection.title')}
      items={templatesList.map((template) => ({
        title: template.name,
        description:
          typeof template.description === 'string' && template.description.length > 0
            ? template.description
            : t('RecentTemplatesSection.noDescription'),
        action: (
          <Button
            preload
            color="secondary"
            label={t('RecentTemplatesSection.viewTemplate')}
            size="small"
            href={`/projects/${template.project_slug}/templates/${template.name}`}
          />
        ),
      }))}
      loadingConfig={{
        isLoading: !data?.body,
        rowsToDisplay: 3,
      }}
      emptyConfig={{
        icon: <TemplateIcon />,
        title: t('RecentTemplatesSection.emptyState.title'),
        description: canCRDTemplates
          ? t('RecentTemplatesSection.emptyState.description')
          : t('RecentTemplatesSection.emptyState.noCrdDescription'),
        action: canCRDTemplates && (
          <CreateNewTemplateDialog
            trigger={
              <Button label={t('RecentTemplatesSection.createTemplate')} bold />
            }
          />
        ),
      }}
      topRightAction={
        canCRDTemplates && (
          <CreateNewTemplateDialog
            trigger={
              <Button
                label={t('RecentTemplatesSection.createTemplate')}
                size="small"
                hideLabel
                preIcon={<PlusIcon />}
              />
            }
          />
        )
      }
      bottomAction={
        <Button
          label={t('RecentTemplatesSection.viewAllTemplates')}
          size="small"
          color="tertiary"
          href={`/projects/${slug}/templates`}
          postIcon={<ChevronRightIcon />}
        />
      }
    />
  );
}

function ProjectPage() {
  const t = useTranslations('projects/(projectSlug)/page');
  const { name } = useCurrentProject();

  const welcomeText = useWelcomeText();

  return (
    <DashboardPageLayout
      headerBottomPadding="large"
      title={welcomeText || ''}
      subtitle={t('subtitle', { name })}
    >
      <DashboardPageSection>
        <HStack wrap>
          <VStack minWidth="mobile" collapseWidth flex>
            <RecentTemplatesSection />
          </VStack>
          <VStack minWidth="mobile" collapseWidth flex>
            <RecentAgentsSection />
          </VStack>
        </HStack>
        <HStack border padding="medium">
          <Tutorials />
        </HStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProjectPage;
