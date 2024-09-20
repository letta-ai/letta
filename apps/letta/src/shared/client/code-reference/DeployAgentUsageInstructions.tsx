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
import { pdkContracts } from '$letta/pdk/contracts';
import { V1_ROUTE } from '$letta/pdk/shared';
import {
  ACCESS_TOKEN_PLACEHOLDER,
  CodeWithAPIKeyInjection,
} from '$letta/client/common';
import { webApi, webApiQueryKeys } from '$letta/client';

interface DeployAgentInstructionsCurlProps {
  sourceAgentKey: string;
  projectId: string;
}

function DeployAgentInstructionsCurl(props: DeployAgentInstructionsCurlProps) {
  const { sourceAgentKey, projectId } = props;
  const [deploymentAgentHasLoaded, setDeploymentAgentHasLoaded] =
    useState(false);
  const [showPartTwo, setShowPartTwo] = useState(false);
  const [useDeploymentAgentId, setUseDeploymentAgentId] =
    useState<boolean>(true);
  const { data } = webApi.projects.getDeployedAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getDeployedAgentsWithSearch(projectId, {
      sourceAgentKey,
      limit: 1,
    }),
    refetchInterval: !deploymentAgentHasLoaded ? 5000 : false,
    queryData: {
      query: {
        sourceAgentKey,
        limit: 1,
      },
      params: {
        projectId: projectId,
      },
    },
  });

  const deploymentAgent = useMemo(() => {
    return data?.body?.deployedAgents[0];
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

  return (
    <VStack className="max-w-[750px]" fullWidth gap="text">
      <Typography align="left" variant="body">
        First you need to create a deployed agent.
      </Typography>
      <Frame paddingY="medium">
        <CodeWithAPIKeyInjection
          testId="deploy-agent-instructions"
          toolbarPosition="bottom"
          language="bash"
          code={`curl -X POST ${environment.NEXT_PUBLIC_CURRENT_HOST}${V1_ROUTE}${pdkContracts.agents.createAgent.path} \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ACCESS_TOKEN_PLACEHOLDER}' \\
  -d '{
    "sourceAgentKey": "${sourceAgentKey}"
  }'`}
        />
      </Frame>
      <Typography bold>Expected Response</Typography>
      <Frame paddingY="medium">
        <Code
          language="javascript"
          code={`{ deploymentAgentId: 'some-id-here' }`}
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
              code={`curl -N -X POST ${
                environment.NEXT_PUBLIC_CURRENT_HOST
              }${V1_ROUTE}${pdkContracts.agents.chatWithAgent.path.replace(
                ':deployedAgentId',
                deploymentAgentToUse
              )} \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ACCESS_TOKEN_PLACEHOLDER}' \\
  -d '{
    "message": "Hello",
    "stream": true
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
  sourceAgentKey: string;
  projectId: string;
}

function RenderInstructions(props: RenderInstructionsProps) {
  const { language, sourceAgentKey, projectId } = props;

  if (language === 'bash') {
    return (
      <DeployAgentInstructionsCurl
        projectId={projectId}
        sourceAgentKey={sourceAgentKey}
      />
    );
  }

  return null;
}

interface DeployAgentUsageInstructionsProps {
  sourceAgentKey: string;
  projectId: string;
}

export function DeployAgentUsageInstructions(
  props: DeployAgentUsageInstructionsProps
) {
  const { sourceAgentKey, projectId } = props;
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
        sourceAgentKey={sourceAgentKey}
        language={language}
      />
    </VStack>
  );
}
