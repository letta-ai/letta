'use client';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import {
  Avatar,
  Button,
  CalendarIcon,
  CopyIcon,
  HStack,
  LettaInvaderIcon,
  LoadingEmptyStatusComponent,
  MaskIcon,
  PanelBar,
  PythonIcon,
  type QueryBuilderQuery,
  RawCodeEditor,
  RocketIcon,
  Skeleton,
  TabGroup,
  TerminalIcon,
  TypescriptIcon,
  Typography,
  useCopyToClipboard,
  VStack,
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '@letta-cloud/ui-ade-components';

import React, { useMemo, useRef, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { ADEGroup } from '@letta-cloud/ui-ade-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  AgentsService,
  UseAgentsServiceListAgentsKeyFn,
  useIdentitiesServiceRetrieveIdentity,
} from '@letta-cloud/sdk-core';
import type { ListAgentsResponse } from '@letta-cloud/sdk-core';
import type { InfiniteData } from '@tanstack/query-core';
import { useDebouncedValue } from '@mantine/hooks';
import { useFeatureFlag, useSetOnboardingStep } from '@letta-cloud/sdk-web';
import { LaunchLinks } from './LaunchLinks/LaunchLinks';
import { VersionHistorySection } from './VersionHistorySection/VersionHistorySection';

import { useFormatters } from '@letta-cloud/utils-client';
import { CreateAgentFromTemplateDialog } from './CreateAgentFromTemplateDialog/CreateAgentFromTemplateDialog';
import { TypescriptInstructions } from './TypescriptInstructions/TypescriptInstructions';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';

type CodeSnippetMethods = 'bash' | 'python' | 'typescript';
type DeploymentMethods = CodeSnippetMethods | 'letta-launch';

interface CodeSnippetViewProps {
  deploymentMethod: CodeSnippetMethods;
}

function isCodeSnippetMethod(value: string): value is CodeSnippetMethods {
  return ['typescript', 'python', 'bash'].includes(value);
}

function CodeSnippetView(props: CodeSnippetViewProps) {
  const { deploymentMethod } = props;
  const { slug } = useCurrentProject();
  const { templateName } = useCurrentAgentMetaData();
  const t = useTranslations('pages/distribution');

  const code = useMemo(() => {
    switch (deploymentMethod) {
      case 'typescript':
        return `
import { LettaClient } from "@letta-ai/letta-client";

const client = new LettaClient({ token: "YOUR_TOKEN" });

// create agent
const { agents } = await client.templates.agents.create("${slug}", "${templateName}:latest");

// message agent
await client.agents.messages.create(agents[0].id, {
  messages: [{
    role: "user",
    content: "hello"
  }]
});
`;

      case 'python':
        return `
from letta_client import Letta

client = Letta(
    token="YOUR_TOKEN",
)

# create agent
response = client.templates.agents.create(
    project="${slug}",
    template_version="${templateName}:latest",
)

# message agent
client.agents.messages.create(
    agent_id=response.agents[0].id,
    messages=[{"role": "user", "content": "hello"}],
)
`;

      case 'bash':
        return `
curl -X POST https://app.letta.com/v1/templates/${slug}/${templateName}:latest/agents \\
     -H "Authorization: Bearer <token>" \\
     -H "Content-Type: application/json" \\
     -d '{}'

curl -X POST https://app.letta.com/v1/agents/agent_id/messages \\
      -H "Authorization: Bearer <token>" \\
      -H "Content-Type: application/json" \\
      -d '{"messages": [{"role": "user", "content": "hello"}]}'
`;
      default:
        return null;
    }
  }, [deploymentMethod, slug, templateName]);

  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: code || '',
  });

  if (!code) {
    return null;
  }

  if (deploymentMethod === 'typescript') {
    return <TypescriptInstructions />;
  }

  return (
    <VStack fullHeight position="relative" color="background-grey">
      <div className="absolute z-header top-0 right-0">
        <HStack padding="small">
          <Button
            label={t('copy')}
            size="small"
            color="tertiary"
            hideLabel
            preIcon={<CopyIcon />}
            onClick={() => {
              void copyToClipboard();
            }}
          />
        </HStack>
      </div>
      <RawCodeEditor
        label=""
        fullWidth
        hideLabel
        color="background-grey"
        variant="minimal"
        showLineNumbers={false}
        fontSize="small"
        code={code.trim()}
        language={deploymentMethod}
      />
    </VStack>
  );
}

function DeploymentInstructions() {
  const { isLoading: isLaunchLinksEnabledLoading, data: isLaunchLinksEnabled } =
    useFeatureFlag('LAUNCH_LINKS');

  const showLaunchLink = !isLaunchLinksEnabledLoading && isLaunchLinksEnabled;

  const { templateName } = useCurrentAgentMetaData();

  const [deploymentMethod, setDeploymentMethod] =
    useState<DeploymentMethods>('typescript');
  const t = useTranslations('pages/distribution');

  const tabs = useMemo(() => {
    const launchLinkTab = {
      icon: <RocketIcon />,
      label: 'Launch Link',
      value: 'letta-launch',
    };

    return [
      {
        icon: <TypescriptIcon />,
        label: 'Typescript',
        value: 'typescript',
      },
      {
        icon: <PythonIcon />,
        label: 'Python',
        value: 'python',
      },
      {
        icon: <TerminalIcon />,
        label: 'cURL',
        value: 'bash',
      },
      ...(showLaunchLink ? [launchLinkTab] : []),
    ];
  }, [showLaunchLink]);

  if (!templateName) {
    return null;
  }

  return (
    <VStack
      collapseHeight
      overflowY="auto"
      paddingX="small"
      fullWidth
      paddingBottom="small"
    >
      <DistributionOnboardingStepFinal>
        <VStack fullWidth overflowX="hidden" fullHeight position="relative">
          <HStack
            /* eslint-disable-next-line react/forbid-component-props */
            className="min-h-[45px]"
            fullWidth
            overflowX="auto"
            align="center"
            justify="spaceBetween"
          >
            <HStack align="center">
              <TabGroup
                variant="chips"
                border
                color="dark"
                bold
                size="xxsmall"
                value={deploymentMethod}
                onValueChange={(value) => {
                  setDeploymentMethod(value as DeploymentMethods);
                }}
                items={tabs}
              />
            </HStack>
            <CreateAgentFromTemplateDialog
              trigger={
                <Button
                  size="small"
                  color="secondary"
                  label={t('createAgent')}
                />
              }
              templateName={templateName}
            />
          </HStack>
          {isCodeSnippetMethod(deploymentMethod) && (
            <CodeSnippetView deploymentMethod={deploymentMethod} />
          )}
          {deploymentMethod === 'letta-launch' && <LaunchLinks />}
        </VStack>
      </DistributionOnboardingStepFinal>
    </VStack>
  );
}

interface AgentIdentityProps {
  identityIds: string[];
}

function AgentIdentity(props: AgentIdentityProps) {
  const { identityIds } = props;
  const [identityId, ...others] = identityIds;

  const t = useTranslations('pages/distribution');
  const hasMoreIdentities = useMemo(() => others.length > 0, [others]);

  const { data } = useIdentitiesServiceRetrieveIdentity({
    identityId,
  });

  if (!data) {
    return (
      <Skeleton
        /* eslint-disable-next-line react/forbid-component-props */
        className="w-[150px] h-[20px]"
      />
    );
  }

  return (
    <HStack gap="small" align="center">
      <Avatar name={data.name} size="xsmall" />
      <Typography variant="body2">{data.name}</Typography>
      {hasMoreIdentities && (
        <Typography variant="body2">
          {t('AgentIdentity.more', { count: others.length })}
        </Typography>
      )}
    </HStack>
  );
}

interface UseRecentAgentsProps {
  debouncedSearch: string;
}

const AGENT_LIMIT = 25;

function useRecentAgents(props: UseRecentAgentsProps) {
  const { id: projectId } = useCurrentProject();
  const { agentId } = useCurrentAgentMetaData();
  const { debouncedSearch } = props;

  return useInfiniteQuery<
    ListAgentsResponse,
    unknown,
    InfiniteData<ListAgentsResponse>,
    unknown[],
    { after?: string | null }
  >({
    queryKey: [
      'infinite',
      ...UseAgentsServiceListAgentsKeyFn({
        projectId,
        baseTemplateId: agentId,
        queryText: debouncedSearch,
        limit: AGENT_LIMIT + 1,
      }),
    ],
    queryFn: ({ pageParam }) => {
      return AgentsService.listAgents({
        queryText: debouncedSearch,
        limit: AGENT_LIMIT + 1,
        after: pageParam?.after,
        projectId,
        baseTemplateId: agentId,
      });
    },
    initialPageParam: { after: null },
    getNextPageParam: (lastPage) => {
      if (lastPage.length > AGENT_LIMIT) {
        return {
          after: lastPage[lastPage.length - 2].id,
        };
      }

      return undefined;
    },
    enabled: !!AGENT_LIMIT,
  });
}

function RecentAgents() {
  const [search, setSearch] = useState('');
  const t = useTranslations('pages/distribution');
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const { slug } = useCurrentProject();
  const { agentName } = useCurrentAgentMetaData();

  const { data, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useRecentAgents({
      debouncedSearch,
    });

  const containerRef = useRef<HTMLDivElement>(null);
  const agents = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.flatMap((page) => page.slice(0, AGENT_LIMIT)) || [];
  }, [data]);

  const { formatDateAndTime } = useFormatters();
  return (
    <VStack gap="small" fullHeight>
      <PanelBar
        searchValue={search}
        onSearch={setSearch}
        actions={
          <Button
            bold
            label={t('viewAgents')}
            target="_blank"
            href={`/projects/${slug}/agents?query=${JSON.stringify({
              root: {
                combinator: 'AND',
                items: [
                  {
                    field: 'version',
                    queryData: {
                      operator: { label: 'equals', value: 'eq' },
                      value: {
                        label: `${agentName}:latest`,
                        value: `${agentName}:latest`,
                      },
                    },
                  },
                ],
              },
            } satisfies QueryBuilderQuery)}`}
            color="secondary"
          />
        }
      />
      <VStack
        paddingX="small"
        paddingBottom="small"
        collapseHeight
        flex
        ref={containerRef}
      >
        {!data && (
          <LoadingEmptyStatusComponent loaderVariant="grower" isLoading />
        )}
        {!!data && agents.length === 0 && (
          <LoadingEmptyStatusComponent
            emptyMessage={
              debouncedSearch
                ? t('RecentAgents.noResults')
                : t('RecentAgents.noAgents')
            }
          />
        )}
        {agents.map((agent) => (
          <HStack
            wrap
            align="center"
            border
            padding="small"
            key={agent.id}
            fullWidth
            justify="spaceBetween"
          >
            <HStack width="contained">
              <VStack gap="small">
                <HStack gap="small" align="center">
                  <LettaInvaderIcon />
                  <Typography>{agent.name}</Typography>
                </HStack>
                <HStack wrap>
                  {(agent.identity_ids || []).length > 0 ? (
                    <AgentIdentity identityIds={agent.identity_ids || []} />
                  ) : (
                    <HStack>
                      <HStack gap="small">
                        <MaskIcon />
                        <Typography align="left" variant="body2">
                          {t('RecentAgents.noIdentity')}
                        </Typography>
                      </HStack>
                    </HStack>
                  )}
                  <HStack gap="small">
                    <CalendarIcon />
                    <Typography align="left" variant="body2">
                      {t('RecentAgents.lastActiveAt', {
                        date: formatDateAndTime(agent.updated_at || ''),
                      })}
                    </Typography>
                  </HStack>
                </HStack>
              </VStack>
            </HStack>
            <HStack align="center">
              <Button
                size="small"
                color="secondary"
                target="_blank"
                label={t('RecentAgents.viewInADE')}
                href={`/projects/${slug}/agents/${agent.id}`}
              />
            </HStack>
          </HStack>
        ))}
        {hasNextPage && (
          <Button
            fullWidth
            color="secondary"
            label={t('RecentAgents.loadMore')}
            onClick={() => {
              void fetchNextPage();
            }}
            disabled={isFetchingNextPage}
          />
        )}
      </VStack>
    </VStack>
  );
}

interface DistributionOnboardingStepFinalProps {
  children: React.ReactNode;
}

function DistributionOnboardingStepFinal(
  props: DistributionOnboardingStepFinalProps,
) {
  const t = useTranslations('pages/distribution');
  const { children } = props;

  const showOnboarding = useShowOnboarding('deploy_agent');
  const { setOnboardingStep } = useSetOnboardingStep();

  if (!showOnboarding) {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      title={t('DistributionOnboardingStepFinal.title')}
      placement="left-start"
      description={t('DistributionOnboardingStepFinal.description')}
      isOpen
      /* eslint-disable-next-line react/forbid-component-props */
      className="w-full h-full"
      nextStep={
        <Button
          label={t('DistributionOnboardingStepFinal.nextStep')}
          color="primary"
          fullWidth
          onClick={() => {
            setOnboardingStep({
              onboardingStep: 'completed',
              stepToClaim: 'deploy_agent',
            });
          }}
        />
      }
      totalSteps={TOTAL_PRIMARY_ONBOARDING_STEPS}
      currentStep={5}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

function AgentsPanel() {
  const { data } = useRecentAgents({
    debouncedSearch: '',
  });

  const agents = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.flatMap((page) => page.slice(0, AGENT_LIMIT)) || [];
  }, [data]);

  if (!data) {
    return (
      <LoadingEmptyStatusComponent loaderVariant="grower" isLoading hideText />
    );
  }

  return (
    <AgentsPanelInner
      defaultTab={agents.length === 0 ? 'distribute-agent' : 'recent-agents'}
    />
  );
}

type AgentPanelTabs = 'distribute-agent' | 'recent-agents';

interface AgentsPanelInnerProps {
  defaultTab: AgentPanelTabs;
}

function AgentsPanelInner(props: AgentsPanelInnerProps) {
  const { defaultTab } = props;
  const [tab, setTab] = useState<AgentPanelTabs>(defaultTab);
  const t = useTranslations('pages/distribution');

  return (
    <VStack gap={false} fullWidth fullHeight>
      <HStack fullWidth paddingX="small">
        <TabGroup
          extendBorder
          value={tab}
          items={[
            {
              value: 'recent-agents',
              label: t('RecentAgents.title'),
            },
            {
              value: 'distribute-agent',
              label: t('DeploymentInstructions.title'),
            },
          ]}
          onValueChange={(value) => {
            setTab(value as AgentPanelTabs);
          }}
          bold
          size="xsmall"
        />
      </HStack>
      {tab === 'recent-agents' && <RecentAgents />}
      {tab === 'distribute-agent' && <DeploymentInstructions />}
    </VStack>
  );
}

export default function DistributionPage() {
  const t = useTranslations('pages/distribution');

  return (
    <ADEPage>
      <VStack fullHeight fullWidth borderY borderRight>
        <PanelGroup
          /* eslint-disable-next-line react/forbid-component-props */
          className="h-full"
          direction="horizontal"
          autoSaveId="distribution"
        >
          <Panel
            defaultSize={65}
            defaultValue={65}
            /* eslint-disable-next-line react/forbid-component-props */
            className="h-full"
            minSize={20}
          >
            <VStack fullHeight gap="small">
              <ADEGroup
                items={[
                  {
                    title: t('VersionList.title'),
                    id: 'versions',
                    content: <VersionHistorySection />,
                  },
                ]}
              ></ADEGroup>
            </VStack>
          </Panel>
          <PanelResizeHandle
            /* eslint-disable-next-line react/forbid-component-props */
            className="w-[1px] bg-border"
          />
          <Panel
            defaultSize={35}
            defaultValue={35}
            /* eslint-disable-next-line react/forbid-component-props */
            className="h-full"
            minSize={20}
          >
            <ADEGroup
              items={[
                {
                  title: t('agents'),
                  id: 'agents',
                  content: <AgentsPanel />,
                },
              ]}
            ></ADEGroup>
          </Panel>
        </PanelGroup>
      </VStack>
    </ADEPage>
  );
}
