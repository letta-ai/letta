/* AgentMessage comes if the tool_call message is send_message */
import type { ToolCallMessage } from '@letta-cloud/sdk-core';
import React, { useCallback, useMemo } from 'react';
import { HStack, Markdown, Typography, VStack } from '@letta-cloud/ui-component-library';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useTranslations } from '@letta-cloud/translations';
import { EditMessageButton } from '../../EditMessageButton/EditMessageButton';
import { jsonrepair } from 'jsonrepair';
import { get } from 'lodash-es';

interface InteractiveAgentMessageProps {
  message: ToolCallMessage
}

function tryFallbackParseJson(str: string): unknown {
  let trimmed = str;

  while (trimmed.length > 0) {
    try {
      return JSON.parse(jsonrepair(trimmed));
    } catch (_e) {
      trimmed = trimmed.slice(0, -1);
    }
  }

  return null;
}

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return tryFallbackParseJson(str);
  }
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

    return get(safeParseJSON(message.tool_call.arguments), 'message');
  }, [message.tool_call.arguments]);


  if (!message.tool_call.arguments) {
    return null;
  }

  if (!content) {
    return (
      <VStack>
        <Typography italic>
          {t('noContent')}
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
