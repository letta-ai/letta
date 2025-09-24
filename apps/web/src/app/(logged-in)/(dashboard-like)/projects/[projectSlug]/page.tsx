'use client';

import {
  ArrowCurveIcon,
  Badge,
  Button,
  ChevronRightIcon,
  DashboardPageLayout,
  DashboardPageSection,
  DynamicStack,
  HStack,
  LettaInvaderIcon,
  LoadedTypography,
  PlusIcon,
  RawInputContainer,
  ResponsesIcon,
  Skeleton,
  TemplateIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import './page.scss';
import { Slot } from '@radix-ui/react-slot';
import React, { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useTranslations } from '@letta-cloud/translations';
import { Tutorials, CopyableValueRow } from '$web/client/components';
import { useWelcomeText } from '$web/client/hooks/useWelcomeText/useWelcomeText';
import { CreateNewTemplateDialog } from './_components/CreateNewTemplateDialog/CreateNewTemplateDialog';
import { DeployAgentDialog } from './agents/DeployAgentDialog/DeployAgentDialog';
import {
  useUserHasPermission,
  useCurrentOrganization,
} from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useAgentsServiceListAgents } from '@letta-cloud/sdk-core';
import { useFormatters } from '@letta-cloud/utils-client';
import {
  cloudAPI,
  cloudQueryKeys,
  type PublicTemplateDetailsType,
} from '@letta-cloud/sdk-cloud-api';
import type { AgentState } from '@letta-cloud/sdk-core';
import { MiniObservabilityDashboard } from './observability/_components/MiniObservabilityDashboard/MiniObservabilityDashboard';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { cn } from '@letta-cloud/ui-styles';

interface LoadingCardsState {
  count: number;
  className?: string;
}

function LoadingState(props: LoadingCardsState) {
  const { count, className } = props;
  return Array.from({ length: count }).map((_, index) => (
    <Skeleton
      key={index}
      className={cn('min-h-[100px]  flex-1 max-h-[100px]', className)}
    />
  ));
}

const AgentCard = ({ agent, slug }: { agent: AgentState; slug: string }) => {
  const t = useTranslations('projects/(projectSlug)/page/RecentAgentsSection');
  const { formatRelativeDate } = useFormatters();
  const { id: currentProjectId } = useCurrentProject();

  const { data: templateData } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesWithSearch({
      template_id: agent.template_id || '',
      limit: 1,
    }),
    queryData: {
      query: {
        template_id: agent.template_id || '',
        project_id: currentProjectId,
        limit: '1',
      },
    },
    enabled: !!agent.template_id,
  });

  const templateName = templateData?.body.templates[0]?.name;

  return (
    <div className="bg-list-item-background relative border border-background-grey3-border min-h-[100px] max-h-[100px] hover:bg-background-grey3 transition-colors cursor-pointer">
      <Link href={`/projects/${slug}/agents/${agent.id}`}>
        <VStack
          paddingX="large"
          paddingY="small"
          fullHeight
          justify="spaceBetween"
          fullWidth
        >
          <VStack gap="small">
            <VStack gap="small">
              <HStack gap="small" align="center" className="min-w-0">
                <LettaInvaderIcon />
                <Typography
                  className="font-bold text-body"
                  overflow="ellipsis"
                  noWrap
                  fullWidth
                >
                  {agent.name}
                </Typography>
                {agent.tags && agent.tags.length > 0 && (
                  <Badge
                    size="small"
                    content={agent.tags[0]}
                    variant="info"
                    border
                    className="ml-2"
                  />
                )}
              </HStack>
              <Typography className="text-sm" color="lighter" variant="body3">
                {t('createdAt', {
                  date: formatRelativeDate(agent.updated_at || ''),
                })}
              </Typography>
            </VStack>
          </VStack>
        </VStack>
      </Link>
      {agent.template_id && (
        <Link
          href={`/projects/${slug}/templates/${templateName}`}
          className="min-w-0 flex-1 hover:bg-background-grey2 absolute bottom-[20px] left-[20px]"
        >
          <HStack gap="small" align="center" className="min-w-0 ">
            <ArrowCurveIcon size="xsmall" />
            <TemplateIcon size="xsmall" />

            <Typography
              className="text-xs"
              color="lighter"
              variant="body3"
              overflow="ellipsis"
              noWrap
              fullWidth
            >
              {templateName || agent.template_id}
            </Typography>
          </HStack>
        </Link>
      )}
    </div>
  );
};

function EmptyAgentList() {
  const [canCreateAgents] = useUserHasPermission(
    ApplicationServices.CREATE_AGENT,
  );

  const t = useTranslations('projects/(projectSlug)/page/RecentAgentsSection');

  return (
    <VStack
      color="background-grey"
      align="center"
      justify="center"
      padding="xlarge"
      className="min-h-[321px]"
    >
      <VStack className="max-w-[300px]" align="center" justify="center">
        <VStack
          align="center"
          justify="center"
          className="w-[64px] h-[64px]"
          color="brand-light"
        >
          <Slot className="w-[36px]">
            <LettaInvaderIcon />
          </Slot>
        </VStack>
        <VStack paddingY="small">
          <Typography align="center" variant="heading4" bold>
            {t('emptyState.title')}
          </Typography>
          <Typography align="center" variant="body" color="lighter">
            {t('emptyState.description')}
          </Typography>
        </VStack>
        {canCreateAgents && (
          <DeployAgentDialog
            trigger={<Button label={t('createAgent')} bold />}
          />
        )}
      </VStack>
    </VStack>
  );
}

const LOAD_AGENTS_COUNT = 6;

function RecentAgentsSection() {
  const { id: currentProjectId, slug } = useCurrentProject();

  const { data } = useAgentsServiceListAgents(
    {
      limit: LOAD_AGENTS_COUNT,
      projectId: currentProjectId,
    },
    undefined,
    {
      retry: false,
    },
  );

  const [canCreateAgents] = useUserHasPermission(
    ApplicationServices.CREATE_AGENT,
  );

  const t = useTranslations('projects/(projectSlug)/page/RecentAgentsSection');

  const agentsList = useMemo(() => data || [], [data]);

  const isLoading = !data;
  const hasNoItems = agentsList.length === 0;

  return (
    <HStack fullHeight position="relative" fullWidth>
      <VStack fullWidth fullHeight border gap="large" padding>
        <HStack className="h-biHeight-sm" align="center" justify="spaceBetween">
          <HStack align="center">
            <Link
              href={`/projects/${slug}/agents`}
              className="text-lg text-text-default font-semibold flex items-center gap-1"
            >
              {t('title')}
              <ChevronRightIcon className="h-5 w-5" />
            </Link>
          </HStack>
          {!hasNoItems && !isLoading && canCreateAgents && (
            <DeployAgentDialog
              trigger={
                <Button
                  label={t('createAgent')}
                  size="small"
                  hideLabel
                  preIcon={<PlusIcon />}
                />
              }
            />
          )}
        </HStack>
        <VStack collapseHeight flex overflowY="auto">
          {isLoading ? (
            <LoadingState count={LOAD_AGENTS_COUNT} />
          ) : hasNoItems ? (
            <EmptyAgentList />
          ) : (
            <VStack>
              {agentsList.map((agent: AgentState) => (
                <AgentCard key={agent.id} agent={agent} slug={slug} />
              ))}
            </VStack>
          )}
        </VStack>
      </VStack>
    </HStack>
  );
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
  const { formatRelativeDate } = useFormatters();
  // Removed copy-to-clipboard for template ID on dashboard card

  const responsesUrl = useMemo(() => {
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
    return `/projects/${slug}/responses?query=${encodeURIComponent(JSON.stringify(query))}`;
  }, [template.id, template.name, slug]);

  const agentsUrl = useMemo(() => {
    const query = {
      root: {
        combinator: 'AND',
        items: [
          {
            field: 'templateName',
            queryData: {
              operator: {
                label: 'equals',
                value: 'eq',
              },
              value: {
                label: template.name,
                value: `${slug}/${template.name}`,
              },
            },
          },
        ],
      },
    };
    return `/projects/${slug}/agents?query=${encodeURIComponent(JSON.stringify(query))}`;
  }, [template.name, slug]);

  const handleResponsesClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      router.push(responsesUrl);
    },
    [router, responsesUrl],
  );

  const handleAgentsClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      router.push(agentsUrl);
    },
    [router, agentsUrl],
  );

  return (
    <div className="bg-list-item-background relative min-w-[350px] flex-1 border border-background-grey3-border min-h-[100px] max-h-[100px] hover:bg-background-grey3 transition-colors cursor-pointer">
      <Link href={`/projects/${slug}/templates/${template.name}`}>
        <VStack
          position="relative"
          paddingX="large"
          paddingY="small"
          justify="spaceBetween"
          fullWidth
        >
          <VStack gap="small">
            <HStack justify="spaceBetween" align="center" fullWidth>
              <HStack gap="small" align="center" className="min-w-0">
                <TemplateIcon />
                <Typography
                  className="font-bold text-body"
                  overflow="ellipsis"
                  noWrap
                  fullWidth
                >
                  {template.name}
                </Typography>
              </HStack>
              <Badge
                content={t('RecentTemplatesSection.version', {
                  version: template.latest_version,
                })}
                variant="info"
                size="small"
                border
                className="ml-2"
              />
            </HStack>
            <Typography className="text-sm" color="lighter" variant="body3">
              {t('RecentTemplatesSection.createdAt', {
                date: formatRelativeDate(template.updated_at || ''),
              })}
            </Typography>
            {/* Description intentionally removed */}
          </VStack>
        </VStack>
      </Link>
      <HStack
        position="absolute"
        className="bottom-[12px] left-[12px]"
        align="center"
        fullWidth
        gap="small"
      >
        <Button
          color="secondary"
          label={t('RecentTemplatesSection.responses')}
          size="small"
          preIcon={<ResponsesIcon />}
          onClick={handleResponsesClick}
        />
        <Button
          color="secondary"
          label={t('RecentTemplatesSection.viewAgents')}
          size="small"
          preIcon={<LettaInvaderIcon />}
          onClick={handleAgentsClick}
        />
      </HStack>
    </div>
  );
};

function EmptyTemplateState() {
  const t = useTranslations('projects/(projectSlug)/page');
  const [canCRDTemplates] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  return (
    <VStack
      color="background-grey"
      align="center"
      justify="center"
      padding="xlarge"
      className="min-h-[316px]"
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
}

function RecentTemplatesSection() {
  const { id: currentProjectId, slug } = useCurrentProject();

  const { data } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesProjectScopedWithSearch(
      currentProjectId,
      {
        search: '',
        limit: 6,
      },
    ),
    queryData: {
      query: {
        project_id: currentProjectId,
        limit: '6',
      },
    },
  });

  const [canCRDTemplates] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  const t = useTranslations('projects/(projectSlug)/page');

  const templatesList = useMemo(() => data?.body.templates || [], [data]);

  const isLoading = !data?.body;
  const hasNoItems = templatesList.length === 0;

  return (
    <VStack fullWidth fullHeight border gap="large" padding>
      <HStack className="h-biHeight-sm" align="center" justify="spaceBetween">
        <HStack align="center">
          <Link
            href={`/projects/${slug}/templates`}
            className="text-lg text-text-default font-semibold flex items-center gap-1"
          >
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

      <VStack collapseHeight flex overflowX="hidden" overflowY="auto">
        {isLoading ? (
          <HStack gap wrap>
            <LoadingState className="min-w-[350px]" count={6} />
          </HStack>
        ) : hasNoItems ? (
          <EmptyTemplateState />
        ) : (
          <HStack gap wrap>
            {templatesList.map((template) => (
              <TemplateCard key={template.id} template={template} slug={slug} />
            ))}
          </HStack>
        )}
      </VStack>
    </VStack>
  );
}

function APIKeyViewer() {
  const t = useTranslations('projects/(projectSlug)/page');

  const [canReadKeys] = useUserHasPermission(ApplicationServices.READ_API_KEYS);
  // API key visibility handled within CopyableValueRow

  const { data: apiKeyData, isLoading: isLoadingApiKey } =
    webApi.apiKeys.getAPIKey.useQuery({
      queryKey: webApiQueryKeys.apiKeys.getApiKey('first'),
      queryData: {
        params: {
          apiKeyId: 'first',
        },
      },
      enabled: canReadKeys,
    });

  const mostRecentApiKey = apiKeyData?.body;

  const formatApiKeyForDisplay = (apiKey: string) => {
    if (!apiKey) return '';
    const prefix = apiKey.startsWith('sk-let-') ? 'sk-let-' : '';
    const maskedLen = Math.max(apiKey.length - prefix.length, 0);
    // Use unicode bullet for standard censoring, preserve exact length
    const bullets = '•'.repeat(maskedLen);
    return `${prefix}${bullets}`;
  };

  return (
    <RawInputContainer fullWidth label={t('ProjectWelcomeCard.apiKey')}>
      {mostRecentApiKey && !isLoadingApiKey && (
        <CopyableValueRow
          value={mostRecentApiKey?.apiKey || ''}
          tooltip={t('ProjectWelcomeCard.clickToCopy')}
          showVisibilityToggle
          maskedDisplay={(v) => formatApiKeyForDisplay(v)}
          testId="api-key-copy"
        />
      )}
      {!mostRecentApiKey && !isLoadingApiKey && (
        <CopyableValueRow
          value={
            canReadKeys
              ? t('ProjectWelcomeCard.noApiKeysFound')
              : t('ProjectWelcomeCard.accessRestricted')
          }
          tooltip={t('ProjectWelcomeCard.clickToCopy')}
          testId="api-key-copy"
        />
      )}
      {isLoadingApiKey && <Skeleton className="h-8 w-full" />}
    </RawInputContainer>
  );
}

function ProjectWelcomeCard() {
  const { id: projectId, name: projectName, updatedAt } = useCurrentProject();
  const currentOrganization = useCurrentOrganization();
  const t = useTranslations('projects/(projectSlug)/page');
  const { formatDateAndTime } = useFormatters();

  return (
    <VStack fullHeight border gap="large" padding justify="spaceBetween">
      <VStack gap="small" fullWidth>
        <HStack align="center" gap="small" justify="spaceBetween" fullWidth>
          <VStack align="start" gap="small" fullWidth>
            <Typography variant="body2" color="muted" align="left">
              {currentOrganization?.name || '--'}
            </Typography>
            <HStack align="center" gap="small" justify="spaceBetween" fullWidth>
              {!projectName ? (
                <LoadedTypography
                  variant="heading3"
                  fillerText={t('ProjectWelcomeCard.loadingProjectName')}
                />
              ) : (
                <Typography variant="heading3" bold align="left">
                  {projectName || '--'}
                </Typography>
              )}
            </HStack>
            {updatedAt && (
              <Typography variant="body3" align="left">
                {t('ProjectWelcomeCard.updatedAt', {
                  datetime: formatDateAndTime(updatedAt),
                })}
              </Typography>
            )}
          </VStack>
        </HStack>
      </VStack>

      <VStack gap="large" fullWidth>
        <APIKeyViewer />
        <RawInputContainer label={t('ProjectWelcomeCard.projectId')} fullWidth>
          <CopyableValueRow
            value={projectId || ''}
            tooltip={t('ProjectWelcomeCard.clickToCopy')}
            testId="project-id-copy"
          />
        </RawInputContainer>
      </VStack>
    </VStack>
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
      className="pl-6"
    >
      <DashboardPageSection>
        <VStack fullWidth fullHeight>
          <DynamicStack className="min-h-[345px]" wrap fullWidth fullHeight>
            <div
              className="w-full largerThanMobile:min-w-[320px]"
              style={{ flex: 1 }}
            >
              <ProjectWelcomeCard />
            </div>
            <div
              className="w-full largerThanMobile:min-w-[500px]"
              style={{ flex: 4 }}
            >
              <MiniObservabilityDashboard />
            </div>
          </DynamicStack>
          <DynamicStack
            className="items-stretch recents-page"
            wrap
            fullWidth
            align="start"
          >
            <div className="w-full overflow-hidden largerThanMobile:h-full largerThanMobile:flex-[3] largerThanMobile:min-w-[500px]">
              <RecentTemplatesSection />
            </div>
            <div
              className="w-full  overflow-hidden  largerThanMobile:h-full largerThanMobile:min-w-[320px]"
              style={{ flex: 1 }}
            >
              <RecentAgentsSection />
            </div>
          </DynamicStack>
          <HStack border padding="medium">
            <Tutorials />
          </HStack>
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProjectPage;
