/* AgentMessage comes if the tool_call message is send_message */
import type { ToolCallMessage } from '@letta-cloud/sdk-core';
import React, { useCallback, useMemo } from 'react';
import { HStack, Markdown, Typography, VStack } from '@letta-cloud/ui-component-library';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useTranslations } from '@letta-cloud/translations';
import { EditMessageButton } from '../../EditMessageButton/EditMessageButton';
import { parseMessageFromPartialJson } from '@letta-cloud/utils-client';

interface InteractiveAgentMessageProps {
  message: ToolCallMessage
}

export function InteractiveAgentMessage(props: InteractiveAgentMessageProps) {

  const { message } = props;

  const t = useTranslations('components/Messages/InteractiveAgentMessage');

  const agentIdWrapper = useCallback(
    (str: string) => {
      if (CURRENT_RUNTIME === 'letta-desktop') {
        return str;
      }

      const baseUrl = window.location.pathname.split('/').slice(1, 3).join('/');

      return str.replace(/agent-[a-f0-9-]{36}/g, (match) => {
        return `[${match}](/${baseUrl}/agents/${match})`;
      });
    },
    [],
  );

  const content = useMemo(() => {
    if (!message.tool_call.arguments) {
      return null;
    }

    return parseMessageFromPartialJson(message.tool_call.arguments);
  }, [message.tool_call.arguments]);


  if (!message.tool_call.arguments) {
    return null;
  }

  if (!content) {
    return (
      <VStack>
        <Typography variant="body3" italic>
          {t('failedToParse')}
        </Typography>
      </VStack>
    )
  }


  return (
    <HStack fullWidth align="start">
      <VStack fullWidth>
        <Markdown text={agentIdWrapper(content)} />
      </VStack>
      <EditMessageButton />
    </HStack>
  );
}
