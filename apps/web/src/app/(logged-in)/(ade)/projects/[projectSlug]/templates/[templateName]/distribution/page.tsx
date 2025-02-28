'use client';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import {
  Avatar,
  Badge,
  Button,
  CalendarIcon,
  CopyIcon,
  HStack,
  LettaInvaderIcon,
  LoadingEmptyStatusComponent,
  MaskIcon,
  PanelBar,
  RawCodeEditor,
  RocketIcon,
  Skeleton,
  TabGroup,
  Typography,
  useCopyToClipboard,
  VStack,
} from '@letta-cloud/component-library';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCurrentAgentMetaData } from '@letta-cloud/shared-ade-components';
import { ADEGroup } from '@letta-cloud/shared-ade-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  AgentsService,
  UseAgentsServiceListAgentsKeyFn,
  useIdentitiesServiceRetrieveIdentity,
} from '@letta-cloud/letta-agents-api';
import type { ListAgentsResponse } from '@letta-cloud/letta-agents-api';
import type { InfiniteData } from '@tanstack/query-core';
import { useDebouncedValue } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { LaunchLinks } from './LaunchLinks/LaunchLinks';
import { VersionHistory } from './VersionHistory/VersionHistory';
import { useLatestAgentTemplate } from '$web/client/hooks/useLatestAgentTemplate/useLatestAgentTemplate';
import { useDateFormatter } from '@letta-cloud/helpful-client-utils';

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
const { agents } = await client.templates.createAgents("${slug}", "${templateName}:latest");

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
response = client.templates.create_agents(
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
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();

  const { data: launchLinkConfig } = webApi.launchLinks.getLaunchLink.useQuery({
    queryKey: webApiQueryKeys.launchLinks.getLaunchLink(agentTemplateId),
    queryData: {
      params: {
        agentTemplateId,
      },
    },
  });

  const isLaunchLinkConfigured = !!launchLinkConfig?.body?.accessLevel;

  const [deploymentMethod, setDeploymentMethod] = useState<DeploymentMethods>(
    isLaunchLinkConfigured ? 'letta-launch' : 'typescript',
  );
  const t = useTranslations('pages/distribution');

  const tabs = useMemo(() => {
    const launchLinkTab = {
      icon: <RocketIcon />,
      label: 'Launch Link',
      value: 'letta-launch',
    };

    return [
      ...(isLaunchLinkConfigured ? [launchLinkTab] : []),
      { label: 'Node.js', value: 'typescript' },
      { label: 'Python', value: 'python' },
      { label: 'cURL', value: 'bash' },
      ...(isLaunchLinkConfigured ? [] : [launchLinkTab]),
    ];
  }, [isLaunchLinkConfigured]);

  return (
    <ADEGroup
      items={[
        {
          title: t('DeploymentInstructions.title'),
          id: 'title',

          content: (
            <VStack
              collapseHeight
              overflowY="auto"
              paddingX="small"
              paddingBottom="small"
            >
              <VStack fullHeight position="relative">
                <HStack border justify="spaceBetween">
                  <TabGroup
                    variant="chips"
                    size="xsmall"
                    value={deploymentMethod}
                    onValueChange={(value) => {
                      setDeploymentMethod(value as DeploymentMethods);
                    }}
                    items={tabs}
                  />
                </HStack>
                {isCodeSnippetMethod(deploymentMethod) && (
                  <CodeSnippetView deploymentMethod={deploymentMethod} />
                )}
                {deploymentMethod === 'letta-launch' && <LaunchLinks />}
              </VStack>
            </VStack>
          ),
        },
      ]}
    ></ADEGroup>
  );
}

const ROW_HEIGHT = 30;

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

function RecentAgents() {
  const [search, setSearch] = useState('');
  const t = useTranslations('pages/distribution');
  const { id: projectId, slug } = useCurrentProject();
  const { agentId } = useCurrentAgentMetaData();
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [limit, setLimit] = useState(0);
  const { deployedAgentTemplate } = useLatestAgentTemplate();

  const { data, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery<
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
          limit: limit + 1,
        }),
      ],
      queryFn: ({ pageParam }) => {
        return AgentsService.listAgents({
          queryText: debouncedSearch,
          limit: limit + 1,
          after: pageParam?.after,
          projectId,
          baseTemplateId: agentId,
        });
      },
      initialPageParam: { after: null },
      getNextPageParam: (lastPage) => {
        if (lastPage.length > limit) {
          return {
            after: lastPage[lastPage.length - 2].id,
          };
        }

        return undefined;
      },
      enabled: !!limit,
    });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // infer limit from container height / 30px (height of each row)
    if (containerRef.current) {
      const newLimit = Math.ceil(
        containerRef.current.clientHeight / ROW_HEIGHT,
      );
      setLimit(newLimit);
    }
  }, []);

  const agents = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.flat() || [];
  }, [data]);

  const { formatDateAndTime } = useDateFormatter();
  return (
    <VStack gap="small" fullHeight>
      <PanelBar searchValue={search} onSearch={setSearch} />
      <VStack
        paddingX="small"
        paddingBottom="small"
        collapseHeight
        flex
        ref={containerRef}
      >
        {!data && <LoadingEmptyStatusComponent isLoading />}
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
                  {deployedAgentTemplate?.id !== agent.template_id && (
                    <Badge
                      variant="warning"
                      content={t('RecentAgents.notAtCurrentVersion')}
                    />
                  )}
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

export default function DistributionPage() {
  const t = useTranslations('pages/distribution');

  return (
    <ADEPage>
      <PanelGroup
        /* eslint-disable-next-line react/forbid-component-props */
        className="h-full"
        direction="horizontal"
        autoSaveId="distribution"
      >
        <Panel
          defaultSize={50}
          defaultValue={50}
          /* eslint-disable-next-line react/forbid-component-props */
          className="h-full"
          minSize={20}
        >
          <VStack fullHeight gap="small">
            <DeploymentInstructions />
            <ADEGroup
              items={[
                {
                  title: t('VersionList.title'),
                  id: 'versions',
                  content: <VersionHistory />,
                },
              ]}
            ></ADEGroup>
          </VStack>
        </Panel>
        <PanelResizeHandle
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-[4px]"
        />
        <Panel
          defaultSize={50}
          defaultValue={50}
          /* eslint-disable-next-line react/forbid-component-props */
          className="h-full"
          minSize={20}
        >
          <ADEGroup
            items={[
              {
                title: t('RecentAgents.title'),
                id: 'title',
                content: <RecentAgents />,
              },
            ]}
          ></ADEGroup>
        </Panel>
      </PanelGroup>
    </ADEPage>
  );
}
