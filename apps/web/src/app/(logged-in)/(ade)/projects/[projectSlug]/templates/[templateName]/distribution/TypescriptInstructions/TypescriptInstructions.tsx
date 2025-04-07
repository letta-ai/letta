import {
  Alert,
  HStack,
  NextjsIcon,
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

interface SubmethodDetails {
  label: string;
  icon?: React.ReactNode;
}

function useSubmethodsDetails(): Record<string, SubmethodDetails> {
  const t = useTranslations('distribution/Instructions/TypescriptInstructions');
  return useMemo(
    () => ({
      nextjs: {
        label: 'Next.JS',
        icon: <NextjsIcon />,
      },
      pure: {
        label: t('methods.pureServer'),
      },
    }),
    [t],
  );
}

function NextJSInstructions() {
  const t = useTranslations('distribution/Instructions/TypescriptInstructions');
  const { slug } = useCurrentProject();
  const { templateName } = useCurrentAgentMetaData();

  return (
    <VStack gap="form">
      <Alert title={t('NextJSInstructions.warning')} variant="info" />
      <TutorialSection title={t('NextJSInstructions.install')}>
        <PackageInstallerView
          installers={NODEJS_INSTALLERS}
          packageNames={[
            '@letta-ai/vercel-ai-sdk-provider',
            'ai',
            '@ai-sdk/react',
          ]}
        />
      </TutorialSection>
      <TutorialSection title={t('NextJSInstructions.setupEnvironment')}>
        <CodeWithAPIKeyInjection
          fontSize="small"
          toolbarPosition="bottom"
          color="background-grey"
          showLineNumbers={false}
          language="bash"
          code={`LETTA_API_KEY=${ACCESS_TOKEN_PLACEHOLDER}
LETTA_DEFAULT_PROJECT_SLUG=${slug}
LETTA_DEFAULT_TEMPLATE_NAME=${templateName}:latest`}
        />
      </TutorialSection>
      <TutorialSection title={t('NextJSInstructions.setupStreaming.title')}>
        <RawCodeEditor
          hideLabel
          label={t('NextJSInstructions.setupStreaming.label')}
          fullWidth
          fontSize="small"
          toolbarPosition="bottom"
          color="background-grey"
          showLineNumbers={false}
          language="typescript"
          code={`import { streamText } from 'ai';
import { lettaCloud } from '@letta-ai/vercel-ai-sdk-provider';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages, agentId } = await req.json();

    if (!agentId) {
        throw new Error('Missing agentId');
    }

    const result = streamText({
        model: lettaCloud(agentId),
        messages,
    });

    return result.toDataStreamResponse();
}
`}
        />
      </TutorialSection>
      <TutorialSection title={t('NextJSInstructions.chatOnTheClient.title')}>
        <RawCodeEditor
          hideLabel
          label={t('NextJSInstructions.chatOnTheClient.label')}
          fullWidth
          fontSize="small"
          toolbarPosition="bottom"
          color="background-grey"
          showLineNumbers={false}
          language="typescript"
          code={`'use client';

import {useChat} from '@ai-sdk/react';
import {useEffect, useMemo, useRef} from "react";
import {Message} from "@ai-sdk/ui-utils";

interface ChatProps {
    agentId: string
    existingMessages: Message[]
    saveAgentIdCookie: (agentId: string) => void
}

export function Chat(props: ChatProps) {
    const {agentId, existingMessages, saveAgentIdCookie} = props;

    const agentIdSaved = useRef<boolean>(false);

    useEffect(() => {
        if (agentIdSaved.current) {
            return;
        }

        agentIdSaved.current = true;
        saveAgentIdCookie(agentId);
    }, [agentId, saveAgentIdCookie]);


    const {messages, status, input, handleInputChange, handleSubmit} = useChat({
        body: {agentId},
        initialMessages: existingMessages,
    });

    const isLoading = useMemo(() => {
        return status === 'streaming' || status === 'submitted'
    }, [status]);

    return (
        <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
            <div>Chatting with {agentId}</div>
            {messages.map(message => (
                <div key={message.id} className="whitespace-pre-wrap">
                    {message.role === 'user' ? 'User: ' : 'AI: '}
                    {message.parts.map((part, i) => {
                        switch (part.type) {
                            case 'text':
                                return <div key={message.id}>{part.text}</div>;
                        }
                    })}
                </div>
            ))}

            <form onSubmit={handleSubmit}>
                {isLoading && (
                    <div className="flex items-center justify-center w-full h-12">
                        Streaming...
                    </div>
                )}
                <input
                    className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
                    value={input}
                    disabled={status !== 'ready'}
                    placeholder="Say something..."
                    onChange={handleInputChange}
                />
            </form>
        </div>
    );
}`}
        />
      </TutorialSection>
      <TutorialSection title={t('NextJSInstructions.createAgent.title')}>
        <RawCodeEditor
          hideLabel
          label={t('NextJSInstructions.createAgent.label')}
          fullWidth
          fontSize="small"
          toolbarPosition="bottom"
          color="background-grey"
          showLineNumbers={false}
          language="typescript"
          code={`'use server';

import {cookies} from "next/headers";
import {
    convertToAiSdkMessage,
    lettaCloud,
    loadDefaultProject,
    loadDefaultTemplate
} from "@letta-ai/vercel-ai-sdk-provider";
import {Chat} from "@/app/Chat";


async function getAgentId() {
    const cookie = await cookies()
    const activeAgentId = cookie.get('active-agent');

    if (activeAgentId) {
        return activeAgentId.value
    }


    if (!loadDefaultTemplate) {
        throw new Error('Missing LETTA_DEFAULT_TEMPLATE_NAME environment variable');
    }

    const response = await lettaCloud.client.templates.createAgents(loadDefaultProject, loadDefaultTemplate)

    const nextActiveAgentId = response.agents[0].id;


    return nextActiveAgentId;
}

async function getExistingMessages(agentId: string) {
    return convertToAiSdkMessage(await lettaCloud.client.agents.messages.list(agentId), {allowMessageTypes: ['user_message', 'assistant_message']});
}

async function saveAgentIdCookie(agentId: string) {
    'use server'
    const cookie = await cookies();
    await cookie.set('active-agent', agentId, {path: '/'});
}

export default async function Homepage() {
    const agentId = await getAgentId();
    const existingMessages = await getExistingMessages(agentId);


    return <Chat existingMessages={existingMessages} saveAgentIdCookie={saveAgentIdCookie} agentId={agentId}/>
}`}
        />
      </TutorialSection>
    </VStack>
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
    case 'nextjs':
      return <NextJSInstructions />;
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
      icon: submethods[key as SubmethodTypes].icon,
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
