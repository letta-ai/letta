import {
  Alert,
  HStack,
  NODEJS_INSTALLERS,
  PackageInstallerView,
  RawCodeEditor,
  TabGroup,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  ACCESS_TOKEN_PLACEHOLDER,
  CodeWithAPIKeyInjection,
} from '$web/client/components';
import { environment } from '@letta-cloud/config-environment-variables';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';

function useSubmethodsDetails() {
  const t = useTranslations('distribution/Instructions/TypescriptInstructions');
  return useMemo(
    () => ({
      pure: {
        label: t('methods.pureServer'),
      },
    }),
    [t],
  );
}

interface TutorialSectionProps {
  title: string;
  children: React.ReactNode;
}

function TutorialSection(props: TutorialSectionProps) {
  return (
    <VStack>
      <Typography bold variant="body2">
        {props.title}
      </Typography>
      {props.children}
    </VStack>
  );
}

type SubmethodTypes = keyof ReturnType<typeof useSubmethodsDetails>;

function PureServerInstructions() {
  const t = useTranslations('distribution/Instructions/TypescriptInstructions');
  const { slug } = useCurrentProject();
  const { templateName } = useCurrentAgentMetaData();
  return (
    <VStack gap="form">
      <Alert title={t('PureServerInstructions.warning')} variant="info" />
      <TutorialSection title={t('PureServerInstructions.install')}>
        <PackageInstallerView
          installers={NODEJS_INSTALLERS}
          packageNames={['@letta-ai/letta-client']}
        />
      </TutorialSection>

      <TutorialSection title={t('PureServerInstructions.initializeYourSdk')}>
        <CodeWithAPIKeyInjection
          fontSize="small"
          toolbarPosition="bottom"
          color="background-grey"
          showLineNumbers={false}
          language="typescript"
          code={`import { LettaClient } from '@letta-ai/letta-client';

const client = new LettaClient({
  baseUrl: '${environment.NEXT_PUBLIC_CURRENT_HOST}',
  token: '${ACCESS_TOKEN_PLACEHOLDER}',
});`}
        />
      </TutorialSection>
      <TutorialSection title={t('PureServerInstructions.createAgentCode')}>
        <RawCodeEditor
          hideLabel
          label={t('PureServerInstructions.createAgentCode')}
          fullWidth
          fontSize="small"
          toolbarPosition="bottom"
          color="background-grey"
          showLineNumbers={false}
          language="typescript"
          code={`async function createAgentAndReturnId(name: string) {
  const response = await client.templates.createAgents('${slug}', '${templateName}:latest', {
    name: "My Agent",
  });

  // this template creates a single agent
  return response.agents[0].id;
}`}
        />
      </TutorialSection>
      <TutorialSection title={t('PureServerInstructions.talkToAgent')}>
        <RawCodeEditor
          hideLabel
          label={t('PureServerInstructions.createAgentCode')}
          fullWidth
          fontSize="small"
          toolbarPosition="bottom"
          color="background-grey"
          showLineNumbers={false}
          language="typescript"
          code={`function talkToAnAgent(agentId: string) {
  const messages = await client.agents.messages.create(agentId, {
    messages: [{
      role: "user",
      content: "hello"
    }]
  });

  console.log(messages);
}`}
        />
      </TutorialSection>
    </VStack>
  );
}

interface ContentSwitcherProps {
  submethod: SubmethodTypes;
}

function ContentSwitcher({ submethod }: ContentSwitcherProps) {
  switch (submethod) {
    case 'pure':
      return <PureServerInstructions />;
    default:
      return null;
  }
}

export function TypescriptInstructions() {
  const [submethod, setSubmethod] = useState<SubmethodTypes>('pure');

  const t = useTranslations('distribution/Instructions/TypescriptInstructions');
  const submethods = useSubmethodsDetails();

  const tabs = useMemo(() => {
    return Object.keys(submethods).map((key) => ({
      label: submethods[key as SubmethodTypes].label,
      value: key,
    }));
  }, [submethods]);

  return (
    <VStack padding="medium" color="background" fullHeight fullWidth gap="form">
      <HStack
        paddingY="xxsmall"
        paddingX="small"
        color="background-grey"
        align="center"
        fullWidth
      >
        <Typography bold variant="body3">
          {t('methods.label')}
        </Typography>
        <TabGroup
          variant="chips"
          border
          color="dark"
          size="xxsmall"
          value={submethod}
          onValueChange={(value) => {
            setSubmethod(value as SubmethodTypes);
          }}
          items={tabs}
        />
      </HStack>
      <VStack fullWidth fullHeight>
        <ContentSwitcher submethod={submethod} />
      </VStack>
    </VStack>
  );
}
