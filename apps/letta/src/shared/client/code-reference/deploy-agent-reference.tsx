import {
  Code,
  Frame,
  HStack,
  RawToggleGroup,
  Typography,
  VStack,
} from '@letta-web/component-library';
import React, { useState } from 'react';
import { environment } from '@letta-web/environmental-variables';
import { pdkContracts } from '$letta/pdk/contracts';
import { V1_ROUTE } from '$letta/pdk/shared';
import {
  ACCESS_TOKEN_PLACEHOLDER,
  CodeWithAPIKeyInjection,
} from '$letta/client/common';

interface DeployAgentInstructionsCurlProps {
  sourceAgentId: string;
}

export function DeployAgentInstructionsCurl(
  props: DeployAgentInstructionsCurlProps
) {
  const { sourceAgentId } = props;

  return (
    <VStack gap="text">
      <Typography align="left" variant="body">
        To use this agent, first you need to create a testing agent.
      </Typography>
      <Frame paddingY="medium">
        <CodeWithAPIKeyInjection
          toolbarPosition="bottom"
          language="bash"
          code={`curl -X POST ${environment.NEXT_PUBLIC_CURRENT_HOST}${V1_ROUTE}${pdkContracts.agents.createAgent.path} \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ACCESS_TOKEN_PLACEHOLDER}' \\
  -d '{
    "sourceAgentId": "${sourceAgentId}",
    "variables": {
      "key": "value"
    }
  }'`}
        />
      </Frame>
      <Typography bold>Expected Response</Typography>
      <Frame paddingY="medium">
        <Code
          language="javascript"
          code={`{ sourceAgentId: 'some-id-here' }`}
        />
      </Frame>

      <Typography align="left" variant="body">
        Then you can proceed to chat with the agent with the `sourceAgentId`
        returned from the above request.
      </Typography>
      <Frame paddingY="medium">
        <CodeWithAPIKeyInjection
          toolbarPosition="bottom"
          language="bash"
          code={`curl -X POST ${environment.NEXT_PUBLIC_CURRENT_HOST}${V1_ROUTE}${pdkContracts.agents.chatWithAgent.path} \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ACCESS_TOKEN_PLACEHOLDER}' \\
  -d '{
    "message": "Hello",
    "name": "Optional Name",
    "variables": {
      "key": "value"
    }
  }'`}
        />
      </Frame>
    </VStack>
  );
}
type SupportedLanguages = 'bash' | 'javascript' | 'python';

function isSupportedLanguage(language: string): language is SupportedLanguages {
  return ['bash', 'javascript', 'python'].includes(language);
}

interface RenderInstructionsProps {
  language: SupportedLanguages;
  sourceAgentId: string;
}

function RenderInstructions(props: RenderInstructionsProps) {
  const { language, sourceAgentId } = props;

  if (language === 'bash') {
    return <DeployAgentInstructionsCurl sourceAgentId={sourceAgentId} />;
  }

  return null;
}

interface DeployAgentUsageInstructionsProps {
  sourceAgentId: string;
}

export function DeployAgentUsageInstructions(
  props: DeployAgentUsageInstructionsProps
) {
  const { sourceAgentId } = props;
  const [language, setLanguage] = useState<SupportedLanguages>('bash');

  return (
    <VStack>
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
      <RenderInstructions sourceAgentId={sourceAgentId} language={language} />
    </VStack>
  );
}
