/* AgentMessage renders assistant output. Historically from send_message tool, now also AssistantMessage */
import type { LettaMessageUnion } from '@letta-cloud/sdk-core';
import React, { useCallback, useMemo } from 'react';
import { HStack, Markdown, Typography, VStack } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { EditMessageButton } from '../../EditMessageButton/EditMessageButton';
import { parseMessageFromPartialJson } from '@letta-cloud/utils-client';
import { getIsLocalPlatform } from '@letta-cloud/utils-shared';

interface InteractiveAgentMessageProps { message: LettaMessageUnion }

export function InteractiveAgentMessage(props: InteractiveAgentMessageProps) {
  const { message } = props;

  const t = useTranslations('components/Messages/InteractiveAgentMessage');

  const agentIdWrapper = useCallback(
    (str: string) => {
      if (getIsLocalPlatform()) {
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
    // Tool call pathway (send_message): parse from arguments JSON
    if (message.message_type === 'tool_call_message') {
      if (!message.tool_call || message.tool_call.name !== 'send_message') {
        return null;
      }
      const args = message.tool_call.arguments;
      if (!args) return null;
      return parseMessageFromPartialJson(args);
    }

    // AssistantMessage pathway: use content directly
    if (message.message_type === 'assistant_message') {
      // Backend should provide string content; guard for safety
      const raw: any = (message as any).content;
      if (typeof raw === 'string') return raw;
      if (Array.isArray(raw)) {
        // attempt to join text-like entries
        const joined = raw
          .map((r) => (typeof r === 'string' ? r : (r?.text ?? '')))
          .join('');
        return joined || null;
      }
      return raw ? String(raw) : null;
    }

    return null;
  }, [message]);


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
