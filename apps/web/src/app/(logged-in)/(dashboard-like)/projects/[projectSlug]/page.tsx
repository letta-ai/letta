'use client';

import {
  ArrowCurveIcon,
  Badge,
  BoxList,
  Button,
  ChevronRightIcon,
  CopyButton,
  DashboardPageLayout,
  DashboardPageSection,
  EyeOpenIcon,
  HiddenOnMobile,
  HStack,
  LettaInvaderIcon,
  PlusIcon,
  ResponsesIcon,
  Skeleton,
  TemplateIcon,
  Tooltip,
  Typography,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/ui-component-library';
import { Slot } from '@radix-ui/react-slot';
import React, { useMemo, useCallback, useState } from 'react';
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
import { useAgentsServiceListAgents, useAgentsServiceRetrieveAgent } from '@letta-cloud/sdk-core';
import { useFormatters } from '@letta-cloud/utils-client';
import { useCopyToClipboard } from '@letta-cloud/ui-component-library';
import { cloudAPI, cloudQueryKeys, type cloudContracts, type PublicTemplateDetailsType } from '@letta-cloud/sdk-cloud-api';
import type { ServerInferResponses } from '@ts-rest/core';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import type { AgentState } from '@letta-cloud/sdk-core';
import {
  Messages,
  DeleteAgentDialog,
} from '@letta-cloud/ui-ade-components';
import {
  CloseIcon,
  DotsVerticalIcon,
  DropdownMenu,
  DropdownMenuItem,
  TrashIcon,
  Card,
  RawInput,
  LettaLoader,
  Frame,
} from '@letta-cloud/ui-component-library';

function LoadingState() {
  return Array.from({ length: 4 }).map((_, index) => (
    <Skeleton key={index} className="min-h-[125px] w-full max-w-[320px]" />
  ));
}

// preview implementation here is same as AgentsList
interface AgentMessagesListProps {
  agentId: string;
}

function AgentMessagesList(props: AgentMessagesListProps) {
  const { agentId } = props;
  const t = useTranslations('projects/(projectSlug)/agents/page');

  return (
    <VStack border collapseHeight>
      <HStack borderBottom paddingX="small" paddingY="small">
        <Typography>{t('latestMessages')}</Typography>
      </HStack>
      <VStack fullHeight position="relative" overflow="hidden">
        <Messages
          mode="interactive"
          disableInteractivity
          isSendingMessage={false}
          agentId={agentId}
        />
      </VStack>
    </VStack>
  );
}

interface DeployedAgentViewProps {
  agent: AgentState;
  onClose: () => void;
  onAgentUpdate: () => void;
}

function DeployedAgentView(props: DeployedAgentViewProps) {
  const { agent, onClose, onAgentUpdate } = props;
  const { name } = agent;
  const { slug: currentProjectSlug } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const { data } = useAgentsServiceRetrieveAgent({
    agentId: agent.id || '',
  });

  return (
    <div className="contents">
      <Frame
        onClick={onClose}
        color="background-black"
        fullHeight
        fullWidth
        /*eslint-disable-next-line react/forbid-component-props */
        className="fixed inset-0 z-[100] fade-in-5 opacity-10"
      />
      <VStack
        /*eslint-disable-next-line react/forbid-component-props */
        className="fixed z-[101] sm:animate-in slide-in-from-right-10 right-0 top-0 h-full w-[90%] max-w-[800px] min-w-[600px]"
        color="background"
        border
        fullHeight
      >
        <HStack
          padding
          paddingY="small"
          borderBottom
          align="center"
          fullWidth
          justify="spaceBetween"
        >
          <HStack align="center" gap="small">
            <Typography align="left" bold variant="heading4">
              {name}
            </Typography>
            <DropdownMenu
              trigger={
                <Button
              data-testid={`agent-actions-button:${agent.id}`}
              color="tertiary"
              label={t('actions')}
              preIcon={<DotsVerticalIcon />}
              size="default"
              hideLabel
                />
              }
              triggerAsChild
            >
              <DeleteAgentDialog
                agentId={agent.id || ''}
                agentName={agent.name || ''}
                trigger={
                  <DropdownMenuItem
                    doNotCloseOnSelect
                    preIcon={<TrashIcon />}
                    label="Delete Agent"
                  />
                }
                onSuccess={() => {
                  onClose();
                  onAgentUpdate();
                }}
              />
            </DropdownMenu>
          </HStack>

          <HStack>
            <Button
              href={`/projects/${currentProjectSlug}/agents/${agent.id}`}
              label={t('openInADE')}
              color="secondary"
            />

            <Button
              onClick={onClose}
              color="tertiary"
              label={t('close')}
              hideLabel
              preIcon={<CloseIcon />}
            />
          </HStack>
        </HStack>
        <VStack padding paddingY="small" overflowY="hidden" fullHeight>
          {!data ? (
            <VStack align="center" justify="center" fullHeight fullWidth>
              <LettaLoader size="large" />
            </VStack>
          ) : (
            <VStack fullHeight overflow="hidden" gap>
              <Card>
                <VStack>
                  <RawInput
                    inline
                    label={t('agentId')}
                    defaultValue={agent.id}
                    readOnly
                    allowCopy
                    fullWidth
                  />
                </VStack>
              </Card>
              <AgentMessagesList agentId={agent.id || ''} />
            </VStack>
          )}
        </VStack>
      </VStack>
    </div>
  );
}

const AgentCard = ({
  agent,
  slug,
  onPreviewClick,
}: {
  agent: AgentState;
  slug: string;
  onPreviewClick: (agent: AgentState) => void;
}) => {
  const t = useTranslations('projects/(projectSlug)/page/RecentAgentsSection');
  const { formatDate } = useFormatters();
  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: agent.id || '',
  });
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

  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPreviewClick(agent);
  }, [agent, onPreviewClick]);

  return (
    <VStack
      className="bg-list-item-background border border-background-grey3-border min-h-[125px] hover:bg-background-grey2 transition-colors cursor-pointer"
      paddingX="large"
      paddingY="small"
      justify="spaceBetween"
      fullWidth
    >
      <Link href={`/projects/${slug}/agents/${agent.id}`}>
        <VStack gap="small">
          <Tooltip asChild content={`Go to ${agent.name}`}>
            <VStack gap="small">
              <HStack gap="small" align="center">
                <LettaInvaderIcon />
                <Typography className="font-bold text-body">{agent.name}</Typography>
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
                  date: formatDate(agent.updated_at || ''),
                })}
              </Typography>
            </VStack>
          </Tooltip>
          <HStack gap="small" align="center" className="min-w-0">
            <ArrowCurveIcon size="xsmall" />
            <TemplateIcon size="xsmall" />
            {agent.template_id ? (
              <Tooltip asChild content={t('goToTemplate', { templateName: templateName || agent.template_id })}>
                <Link
                  href={`/projects/${slug}/templates/${templateName || agent.template_id}`}
                  onClick={(e) => e.stopPropagation()}
                >
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
                </Link>
              </Tooltip>
            ) : (
              <Typography
                className="text-xs"
                color="lighter"
                variant="body3"
                overflow="ellipsis"
                noWrap
                fullWidth
              >
                {t('starterKitTemplate')}
              </Typography>
            )}
          </HStack>
        </VStack>
      </Link>
      <HStack align="center" fullWidth gap="small">
          <Button
            color="secondary"
            label="Preview"
            size="small"
            preIcon={<EyeOpenIcon />}
            onClick={handlePreviewClick}
          />
          <HStack
            align="center"
            color="background-grey2"
            border
            paddingLeft="xsmall"
            paddingY="xxsmall"
            className="border-background-grey2-border dark:border-background-grey3-border flex-1 min-w-0 cursor-pointer hover:bg-background-grey3 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard();
            }}
          >
            <Typography
              className="font-mono text-xs truncate"
              color="lighter"
              variant="body3"
              overrideEl="span"
              fullWidth
            >
              {agent.id || ''}
            </Typography>
          </HStack>
        <div onClick={(e) => e.stopPropagation()}>
          <CopyButton
            textToCopy={agent.id || ''}
            size="small"
            hideLabel
            color="tertiary"
            iconColor="muted"
          />
        </div>
      </HStack>
    </VStack>
  );
};

interface AgentGridProps {
  data?: AgentState[];
  canCreateAgents: boolean;
  slug: string;
}

function AgentGrid({ data, canCreateAgents, slug }: AgentGridProps) {
  const t = useTranslations('projects/(projectSlug)/page/RecentAgentsSection');
  const [selectedAgent, setSelectedAgent] = useState<AgentState>();

  const agentsList = useMemo(() => data || [], [data]);

  const isLoading = !data;
  const hasNoItems = agentsList.length === 0;

  const clearSelectedAgent = useCallback(() => {
    setSelectedAgent(undefined);
  }, []);

  const handlePreviewClick = useCallback((agent: AgentState) => {
    setSelectedAgent(agent);
  }, []);

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
            trigger={
              <Button label={t('createAgent')} bold />
            }
          />
        )}
      </VStack>
    </VStack>
  );

  return (
    <HStack fullHeight position="relative" fullWidth>
      <VStack fullWidth fullHeight border gap="large" padding>
        <HStack className="h-biHeight-sm" align="center" justify="spaceBetween">
          <HStack align="center">
            <Link href={`/projects/${slug}/agents`} className="text-lg text-text-default font-semibold flex items-center gap-1">
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

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 w-full">
            <LoadingState />
          </div>
        ) : hasNoItems ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 w-full">
            {agentsList.map((agent: AgentState) => (
              <AgentCard key={agent.id} agent={agent} slug={slug} onPreviewClick={handlePreviewClick} />
            ))}
          </div>
        )}
      </VStack>
      {selectedAgent && (
        <DeployedAgentView
          onClose={() => {
            setSelectedAgent(undefined);
          }}
          agent={selectedAgent}
          onAgentUpdate={clearSelectedAgent}
        />
      )}
    </HStack>
  );
}

interface RecentAgentsBoxListProps {
  data?: AgentState[];
  canCreateAgents: boolean;
  slug: string;
}

function RecentAgentsBoxList({ data, canCreateAgents, slug }: RecentAgentsBoxListProps) {
  const { formatDate } = useFormatters();
  const t = useTranslations('projects/(projectSlug)/page/RecentAgentsSection');

  return (
    <BoxList
      icon={<LettaInvaderIcon />}
      title={t('title')}
      topRightAction={
        canCreateAgents && (
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
        )
      }
      items={(data || []).map((agent) => ({
        title: agent.name,
        description: t('createdAt', {
          date: formatDate(agent.updated_at || ''),
        }),
        action: (
          <Button
            color="secondary"
            label={t('viewAgent')}
            size="small"
            href={`/projects/${slug}/agents/${agent.id}`}
          />
        ),
      }))}
      loadingConfig={{
        isLoading: !data,
        rowsToDisplay: 3,
      }}
      emptyConfig={{
        icon: <LettaInvaderIcon />,
        title: t('emptyState.title'),
        description: t('emptyState.description'),
        action: (
          <Button
            bold
            disabled
            label={t('noAgents')}
            color="secondary"
          />
        ),
      }}
      bottomAction={
        <Button
          label={t('viewAllAgents')}
          size="small"
          color="tertiary"
          href={`/projects/${slug}/agents`}
          postIcon={<ChevronRightIcon />}
        />
      }
    />
  );
}

function RecentAgentsSection() {
  const { data: useGridView } = useFeatureFlag('AGENTS_GRID_VIEW');
  const { id: currentProjectId, slug } = useCurrentProject();

  const { data: agents } = useAgentsServiceListAgents(
    {
      limit: 4,
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

  const sharedProps = {
    data: agents,
    canCreateAgents,
    slug,
  };

  if (useGridView) {
    return <AgentGrid {...sharedProps} />;
  }

  return <RecentAgentsBoxList {...sharedProps} />;
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


  const TemplateCard = ({
  template,
  slug,
}: {
  template: PublicTemplateDetailsType;
  slug: string;
}) => {
  const router = useRouter();
  const t = useTranslations('projects/(projectSlug)/page');
  const { formatDate } = useFormatters();
  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: template.id || '',
  });

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
    >
      <Tooltip asChild content={`Go to ${template.name}`}>
        <Link href={`/projects/${slug}/templates/${template.name}`}>
          <VStack gap="small">
            <HStack justify="spaceBetween" align="center" fullWidth>
              <HStack gap="small" align="center">
                <TemplateIcon />
                <Typography className="font-bold text-body">{template.name}</Typography>
              </HStack>
              <Badge
                content={t('RecentTemplatesSection.version', { version: template.latest_version })}
                variant="info"
                size="small"
                border
                className="ml-2"
              />
            </HStack>
            <Typography className="text-sm" color="lighter" variant="body3">
              {t('RecentTemplatesSection.createdAt', {
                date: formatDate(template.updated_at || ''),
              })}
            </Typography>
            <HStack
              align="start"
              border
              paddingY="xxsmall"
              paddingX="small"
              fullWidth
              className="bg-gray-100 dark:bg-gray-700 border-background-grey3-border dark:border-background-grey4-border"
            >
              <Typography
                className="line-clamp-2 text-sm leading-relaxed"
                color="lighter"
                variant="body3"
              >
                {template.description || t('RecentTemplatesSection.noDescription')}
              </Typography>
            </HStack>
          </VStack>
        </Link>
      </Tooltip>
      <HStack align="center" fullWidth gap="small">
          <Button
            color="secondary"
            label={t('RecentTemplatesSection.responses')}
            size="small"
            preIcon={<ResponsesIcon />}
            onClick={handleResponsesClick}
          />
          <HStack
            align="center"
            color="background-grey2"
            border
            paddingLeft="xsmall"
            paddingY="xxsmall"
            className="border-background-grey2-border dark:border-background-grey3-border flex-1 min-w-0 cursor-pointer hover:bg-background-grey3 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard();
            }}
          >
            <Typography
              className="font-mono text-xs truncate"
              color="lighter"
              variant="body3"
              overrideEl="span"
              fullWidth
            >
              {template.id || ''}
            </Typography>
          </HStack>
          <div onClick={(e) => e.stopPropagation()}>
            <CopyButton
              textToCopy={template.id || ''}
              size="small"
              hideLabel
              color="tertiary"
              iconColor="muted"
            />
          </div>
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
            <Link href={`/projects/${slug}/templates`} className="text-lg text-text-default font-semibold flex items-center gap-1">
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
        <>
          <HiddenOnMobile>
            <div className="grid grid-cols-2 gap-4 w-full">
              <LoadingState />
            </div>
          </HiddenOnMobile>
          <VisibleOnMobile>
            <div className="grid grid-cols-1 gap-4 w-full">
              <LoadingState />
            </div>
          </VisibleOnMobile>
        </>
      ) : hasNoItems ? (
        <EmptyState />
      ) : (
        <>
          <HiddenOnMobile>
            <div className="grid grid-cols-2 gap-4 w-full">
              {templatesList.map((template) => (
                <TemplateCard key={template.id} template={template} slug={slug} />
              ))}
            </div>
          </HiddenOnMobile>
          <VisibleOnMobile>
            <div className="grid grid-cols-1 gap-4 w-full">
              {templatesList.map((template) => (
                <TemplateCard key={template.id} template={template} slug={slug} />
              ))}
            </div>
          </VisibleOnMobile>
        </>
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
        <VStack gap="large" fullWidth>
          <HiddenOnMobile>
            <HStack gap="xlarge" fullWidth align="start">
              <div style={{ width: '67%' }}>
                <RecentTemplatesSection />
              </div>
              <div style={{ width: '33%' }}>
                <RecentAgentsSection />
              </div>
            </HStack>
          </HiddenOnMobile>
          <VisibleOnMobile>
            <VStack gap="large" fullWidth>
              <RecentTemplatesSection />
              <RecentAgentsSection />
            </VStack>
          </VisibleOnMobile>
          <HStack border padding="medium">
            <Tutorials />
          </HStack>
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProjectPage;
