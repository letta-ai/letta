import {
  Code,
  Frame,
  HStack,
  LettaLoader,
  RawSwitch,
  RawToggleGroup,
  Typography,
  VStack,
} from '@letta-web/component-library';
import React, { useEffect, useMemo, useState } from 'react';
import { environment } from '@letta-web/environmental-variables';
import {
  ACCESS_TOKEN_PLACEHOLDER,
  CodeWithAPIKeyInjection,
} from '$letta/client/components';
import { webApi, webApiQueryKeys } from '$letta/client';
import { findMemoryBlockVariables } from '$letta/utils';
import { useCurrentAgent } from '../../../app/(logged-in)/(ade)/projects/[projectSlug]/agents/[agentId]/hooks';
import { getIsAgentState } from '@letta-web/letta-agents-api';

interface DeployAgentInstructionsCurlProps {
  projectId: string;
  versionKey: string;
}

function DeployAgentInstructionsCurl(props: DeployAgentInstructionsCurlProps) {
  const { projectId, versionKey } = props;
  const [deploymentAgentHasLoaded, setDeploymentAgentHasLoaded] =
    useState(false);
  const [showPartTwo, setShowPartTwo] = useState(false);
  const [useDeploymentAgentId, setUseDeploymentAgentId] =
    useState<boolean>(true);
  const { data } = webApi.projects.getDeployedAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getDeployedAgentsWithSearch(projectId, {
      deployedAgentTemplateVersion: versionKey,
      limit: 1,
    }),
    refetchInterval: !deploymentAgentHasLoaded ? 5000 : false,
    queryData: {
      query: {
        deployedAgentTemplateVersion: versionKey,
        limit: 1,
      },
      params: {
        projectId: projectId,
      },
    },
  });

  const agent = useCurrentAgent();

  const deploymentAgent = useMemo(() => {
    return data?.body?.agents[0];
  }, [data]);

  useEffect(() => {
    if (deploymentAgent) {
      setDeploymentAgentHasLoaded(true);
      setShowPartTwo(true);
    }
  }, [deploymentAgent]);

  const deploymentAgentToUse = useMemo(() => {
    return useDeploymentAgentId && deploymentAgent?.id
      ? deploymentAgent.id
      : 'YOUR_AGENT_ID_HERE';
  }, [useDeploymentAgentId, deploymentAgent]);

  const variables = useMemo(() => {
    if (!getIsAgentState(agent)) {
      return [];
    }

    return Object.fromEntries(
      findMemoryBlockVariables(agent).map((v) => [v, 'YOUR_VALUE_HERE'])
    );
  }, [agent]);

  return (
    // eslint-disable-next-line react/forbid-component-props
    <VStack className="max-w-[750px]" fullWidth gap="text">
      <Typography align="left" variant="body">
        First you need to create an agent.
      </Typography>
      <Frame paddingY="medium">
        <CodeWithAPIKeyInjection
          testId="deploy-agent-instructions"
          toolbarPosition="bottom"
          language="bash"
          code={`curl -X POST ${
            environment.NEXT_PUBLIC_CURRENT_HOST
          }/v1/agents \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ACCESS_TOKEN_PLACEHOLDER}' \\
  -d '{
    "from_template": "${versionKey}"${
            variables ? `,\n    "variables": ${JSON.stringify(variables)}` : ''
          }
  }'`}
        />
      </Frame>
      <Typography bold>Expected Response</Typography>
      <Frame paddingY="medium">
        <Code
          language="javascript"
          code={`{ \n\t"id": "some-id-here", \n \t...otherAgentData\n }`}
        />
      </Frame>

      {showPartTwo ? (
        <>
          <Typography align="left" variant="body">
            Then you can proceed to chat with the agent with the
            `deploymentAgentId` returned from the above request.
          </Typography>
          <Frame paddingY="medium">
            <CodeWithAPIKeyInjection
              toolbarAction={
                deploymentAgent?.id && (
                  <RawSwitch
                    label="Use most recent deployed agent ID"
                    checked={useDeploymentAgentId}
                    onClick={() => {
                      setUseDeploymentAgentId((v) => !v);
                    }}
                  />
                )
              }
              testId="chat-with-agent-instructions"
              toolbarPosition="bottom"
              language="bash"
              code={`curl -N -X POST ${environment.NEXT_PUBLIC_CURRENT_HOST}/v1/agents/${deploymentAgentToUse}/messages \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: text/event-stream' \\
  -H 'Authorization: Bearer ${ACCESS_TOKEN_PLACEHOLDER}' \\
  -d '{
    "messages": [{ "role": "user", "text": "Hello" }],
    "stream_steps": true,
    "stream_tokens": true
  }'`}
            />
          </Frame>
        </>
      ) : (
        <HStack
          rounded
          align="center"
          border
          color="background-greyer"
          padding="small"
        >
          <div>
            <LettaLoader size="small" />
          </div>
          <Typography>
            Waiting for you to deploy an agent to show the next step.
          </Typography>

          <button
            onClick={() => {
              setShowPartTwo(true);
            }}
          >
            <Typography underline>See it anyway?</Typography>
          </button>
        </HStack>
      )}
    </VStack>
  );
}
type SupportedLanguages = 'bash' | 'javascript' | 'python';

function isSupportedLanguage(language: string): language is SupportedLanguages {
  return ['bash', 'javascript', 'python'].includes(language);
}

interface RenderInstructionsProps {
  language: SupportedLanguages;
  versionKey: string;
  projectId: string;
}

function RenderInstructions(props: RenderInstructionsProps) {
  const { language, versionKey, projectId } = props;

  if (language === 'bash') {
    return (
      <DeployAgentInstructionsCurl
        projectId={projectId}
        versionKey={versionKey}
      />
    );
  }

  return null;
}

interface DeployAgentUsageInstructionsProps {
  versionKey: string;
  projectId: string;
}

export function DeployAgentUsageInstructions(
  props: DeployAgentUsageInstructionsProps
) {
  const { versionKey, projectId } = props;
  const [language, setLanguage] = useState<SupportedLanguages>('bash');

  return (
    <VStack fullWidth>
      <HStack justify="spaceBetween">
        <Typography bold>Usage Instructions</Typography>
        <RawToggleGroup
          size="small"
          hideLabel
          label="Select Language"
          value={language}
          onValueChange={(val) => {
            if (isSupportedLanguage(val)) {
              setLanguage(val);
            }
          }}
          items={[
            { label: 'Curl', value: 'bash' },
            // { label: 'Python', value: 'python' },
            // { label: 'JavaScript', value: 'javascript' },
          ]}
        />
      </HStack>
      <RenderInstructions
        projectId={projectId}
        versionKey={versionKey}
        language={language}
      />
    </VStack>
  );
}
