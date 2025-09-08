'use client';

import {
  Badge,
  BoxList,
  Button,
  ChevronRightIcon,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  LettaInvaderIcon,
  PlusIcon,
  ResponsesIcon,
  Skeleton,
  TemplateIcon,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { Slot } from '@radix-ui/react-slot';
import React, { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';
import { Tutorials } from '$web/client/components';
import { useWelcomeText } from '$web/client/hooks/useWelcomeText/useWelcomeText';
import { CreateNewTemplateDialog } from './_components/CreateNewTemplateDialog/CreateNewTemplateDialog';
import { DeployAgentDialog } from './agents/DeployAgentDialog/DeployAgentDialog';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useAgentsServiceListAgents } from '@letta-cloud/sdk-core';
import { useFormatters } from '@letta-cloud/utils-client';
import { cloudAPI, cloudQueryKeys, type cloudContracts, type PublicTemplateDetailsType } from '@letta-cloud/sdk-cloud-api';
import type { ServerInferResponses } from '@ts-rest/core';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

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

  const [canCreateAgents] = useUserHasPermission(
    ApplicationServices.CREATE_AGENT,
  );

  return (
    <BoxList
      icon={<LettaInvaderIcon />}
      title={t('RecentAgentsSection.title')}
      topRightAction={
        canCreateAgents && (
          <DeployAgentDialog
            trigger={
              <Button
                label={t('RecentAgentsSection.createAgent')}
                size="small"
                hideLabel
                preIcon={<PlusIcon />}
              />
            }
          />
        )
      }
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

interface RecentTemplatesBoxListProps {
  data?: ServerInferResponses<typeof cloudContracts.templates.listTemplates, 200>;
  canCRDTemplates: boolean;
  slug: string;
}

function RecentTemplatesBoxList({ data, canCRDTemplates, slug }: RecentTemplatesBoxListProps) {
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

  function LoadingState() {
    return Array.from({ length: 6 }).map((_, index) => (
      <Skeleton key={index} className="min-h-[125px] w-full" />
    ));
  }

  const TemplateCard = ({
  template,
  slug,
}: {
  template: PublicTemplateDetailsType;
  slug: string;
}) => {
  const router = useRouter();
  const t = useTranslations('projects/(projectSlug)/page');

  const handleCardClick = useCallback(() => {
    router.push(`/projects/${slug}/templates/${template.name}`);
  }, [router, template.name, slug]);

  const handleResponsesClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const query = {
      root: {
        combinator: 'AND',
        items: [
          {
            field: 'templateFamily',
            queryData: {
              operator: {
                label: 'equals',
                value: 'eq',
              },
              value: {
                label: template.name,
                value: template.id,
              },
            },
          },
        ],
      },
    };
    const responsesUrl = `/projects/${slug}/responses?query=${encodeURIComponent(JSON.stringify(query))}`;
    router.push(responsesUrl);
  }, [template.id, template.name, router, slug]);

  return (
    <VStack
      className="bg-list-item-background border border-background-grey3-border min-h-[125px] hover:bg-background-grey2 transition-colors cursor-pointer"
      paddingX="large"
      paddingY="small"
      justify="spaceBetween"
      fullWidth
      onClick={handleCardClick}
    >
      <VStack gap="small">
        <HStack gap="small" align="center">
          <TemplateIcon />
          <Typography className="font-bold text-body">{template.name}</Typography>
        </HStack>
        <Tooltip asChild content="Template description">
        <HStack
          align="center"
          color="background-grey2"
          border
          paddingLeft="xsmall"
          paddingY="xxsmall"
          fullWidth
          className="border-background-grey2-border dark:border-background-grey3-border"
        >
          <HStack fullWidth align="center" as="span">
            <Typography
              className="line-clamp-2 min-h-[2.5rem] flex items-start"
              color="lighter"
              variant="body3"
              overrideEl="span"
            >
              {template.description || t('RecentTemplatesSection.noDescription')}
            </Typography>
          </HStack>
        </HStack>
        </Tooltip>
      </VStack>
      <HStack justify="spaceBetween" align="center" fullWidth>
        <Button
          color="secondary"
          label={t('RecentTemplatesSection.responses')}
          size="small"
          preIcon={<ResponsesIcon />}
          onClick={handleResponsesClick}
        />
        <Badge
          content={t('RecentTemplatesSection.version', { version: template.latest_version })}
          variant="info"
          size="small"
          border
        />
      </HStack>
    </VStack>
  );
};

interface TemplateGridProps {
  data?: ServerInferResponses<typeof cloudContracts.templates.listTemplates, 200>;
  canCRDTemplates: boolean;
  slug: string;
}

function TemplateGrid({ data, canCRDTemplates, slug }: TemplateGridProps) {
  const t = useTranslations('projects/(projectSlug)/page');

  const templatesList = useMemo(() => data?.body.templates || [], [data]);

  const isLoading = !data?.body;
  const hasNoItems = templatesList.length === 0;

  const EmptyState = () => (
    <VStack
      color="background-grey"
      align="center"
      justify="center"
      padding="xlarge"
      className="min-h-[250px]"
    >
      <VStack className="max-w-[300px]" align="center" justify="center">
        <VStack
          align="center"
          justify="center"
          className="w-[64px] h-[64px]"
          color="brand-light"
        >
          <Slot className="w-[36px]">
            <TemplateIcon />
          </Slot>
        </VStack>
        <VStack paddingY="small">
          <Typography align="center" variant="heading4" bold>
            {t('RecentTemplatesSection.emptyState.title')}
          </Typography>
          <Typography align="center" variant="body" color="lighter">
            {canCRDTemplates
              ? t('RecentTemplatesSection.emptyState.description')
              : t('RecentTemplatesSection.emptyState.noCrdDescription')}
          </Typography>
        </VStack>
        {canCRDTemplates && (
          <CreateNewTemplateDialog
            trigger={
              <Button label={t('RecentTemplatesSection.createTemplate')} bold />
            }
          />
        )}
      </VStack>
    </VStack>
  );


  return (
    <VStack fullWidth fullHeight border gap="large" padding>
      <HStack className="h-biHeight-sm" align="center" justify="spaceBetween">
        <HStack align="center">
                     <Link href={`/projects/${slug}/templates`} className="text-lg text-black font-semibold flex items-center gap-1">
            {t('RecentTemplatesSection.title')}
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
        </HStack>
        {!hasNoItems && !isLoading && canCRDTemplates && (
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
        )}
      </HStack>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 w-full">
          <LoadingState />
        </div>
      ) : hasNoItems ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-4 w-full">
          {templatesList.map((template) => (
            <TemplateCard key={template.id} template={template} slug={slug} />
          ))}
        </div>
      )}
    </VStack>
  );
}

function RecentTemplatesSection() {
  const { data: useGridView } = useFeatureFlag('TEMPLATES_GRID_VIEW');
  const { id: currentProjectId, slug } = useCurrentProject();

  const { data } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesProjectScopedWithSearch(currentProjectId, {
      search: '',
      limit: useGridView ? 6 : 3,
    }),
    queryData: {
      query: {
        project_id: currentProjectId,
        limit: useGridView ? '6' : '3',
      },
    },
  });

  const [canCRDTemplates] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  const sharedProps = {
    data,
    canCRDTemplates,
    slug,
    currentProjectId,
  };

  if (useGridView) {
    return <TemplateGrid {...sharedProps} />;
  }

  return <RecentTemplatesBoxList {...sharedProps} />;
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
