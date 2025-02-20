'use client';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import {
  Button,
  CopyIcon,
  HStack,
  PanelBar,
  PlusIcon,
  RawCodeEditor,
  RocketIcon,
  TabGroup,
  Typography,
  useCopyToClipboard,
  VStack,
} from '@letta-cloud/component-library';
import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { useCurrentAgentMetaData } from '@letta-cloud/shared-ade-components';
import { ADEGroup } from '@letta-cloud/shared-ade-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

type CodeSnippetMethods = 'bash' | 'python' | 'typescript';
type DeploymentMethods = CodeSnippetMethods | 'letta-launch';

interface CodeSnippetViewProps {
  deploymentMethod: CodeSnippetMethods;
}

function isCodeSnippetMethod(value: string): value is CodeSnippetMethods {
  return ['typescript', 'python', 'bash'].includes(value);
}

function LettaLaunchView() {
  const t = useTranslations('pages/distribution');

  return (
    <VStack
      color="background-grey"
      fullHeight
      justify="center"
      fullWidth
      align="center"
    >
      <RocketIcon size="xxlarge" />
      <Typography variant="heading5" bold>
        {t('LettaLaunchView.title')}
      </Typography>
      <div className="max-w-[600px]">
        <Typography>{t('LettaLaunchView.description')}</Typography>
      </div>
      <Button label={t('LettaLaunchView.cta')} color="primary" />
    </VStack>
  );
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
  const [deploymentMethod, setDeploymentMethod] =
    useState<DeploymentMethods>('typescript');
  const t = useTranslations('pages/distribution');

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
                    items={[
                      { label: 'Node.js', value: 'typescript' },
                      { label: 'Python', value: 'python' },
                      { label: 'cURL', value: 'bash' },
                      {
                        icon: <RocketIcon />,
                        label: 'Launch Link',
                        value: 'letta-launch',
                      },
                    ]}
                  />
                </HStack>
                {isCodeSnippetMethod(deploymentMethod) && (
                  <CodeSnippetView deploymentMethod={deploymentMethod} />
                )}
                {deploymentMethod === 'letta-launch' && <LettaLaunchView />}
              </VStack>
            </VStack>
          ),
        },
      ]}
    ></ADEGroup>
  );
}

function RecentAgents() {
  const [search, setSearch] = useState('');
  const t = useTranslations('pages/distribution');
  return (
    <VStack fullHeight>
      <PanelBar
        searchValue={search}
        onSearch={setSearch}
        actions={
          <Button
            hideLabel
            color="secondary"
            preIcon={<PlusIcon />}
            label={t('RecentAgents.addAgent')}
          />
        }
      />
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
                  content: <RecentAgents />,
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
