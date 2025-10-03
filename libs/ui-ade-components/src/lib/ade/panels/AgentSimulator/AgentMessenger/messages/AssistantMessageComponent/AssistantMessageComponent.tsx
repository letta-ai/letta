import type { AssistantMessage } from '@letta-cloud/sdk-core';
import type { MessageAdditionalMetadata } from '../types';
import { HStack, Markdown, VStack } from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo } from 'react';
import { getIsLocalPlatform } from '@letta-cloud/utils-shared';

interface AssistantMessageComponentProps {
  message: AssistantMessage;
  metadata: MessageAdditionalMetadata;
}

export function AssistantMessageComponent(props: AssistantMessageComponentProps) {
  const { message } = props;

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

    return  !Array.isArray(message.content) ? message.content : message.content.map((part => {
      return part.text;
    })).join('');
  }, [message]);


  return (
    <HStack fullWidth align="start">
      <VStack fullWidth>
        <Markdown text={agentIdWrapper(content)} />
      </VStack>
    </HStack>
  );
}
