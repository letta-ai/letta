'use client';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import {
  Button,
  CopyIcon,
  HStack,
  PythonIcon,
  RawCodeEditor,
  RocketIcon,
  TabGroup,
  TerminalIcon,
  TypescriptIcon,
  useCopyToClipboard,
  VStack,
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '@letta-cloud/ui-ade-components';

import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { ADEGroup } from '@letta-cloud/ui-ade-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useFeatureFlag, useSetOnboardingStep } from '@letta-cloud/sdk-web';
import { LaunchLinks } from './LaunchLinks/LaunchLinks';
import { VersionHistorySection } from './VersionHistorySection/VersionHistorySection';

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
                  title: t('distribution'),
                  id: 'distribution',
                  content: <DeploymentInstructions />,
                },
              ]}
            ></ADEGroup>
          </Panel>
        </PanelGroup>
      </VStack>
    </ADEPage>
  );
}
