import type { ApprovalRequestMessage } from '@letta-cloud/sdk-core';
import {
  Badge,
  Button,
  CopyIcon,
  DropdownMenu,
  DropdownMenuItem,
  Frame,
  HStack,
  InfoIcon,
  JSONViewer,
  Typography,
  useCopyToClipboard,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { jsonToCurl } from '@letta-cloud/utils-shared';
import { useCurrentAPIHostConfig } from '@letta-cloud/utils-client';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';

interface HTILConfirmationInputProps {
  message: ApprovalRequestMessage;
  mostRecentMessageId: string;
  onApprove: () => void;
  onDeny: () => void;
}

export function HTILConfirmationInput(props: HTILConfirmationInputProps) {
  const t = useTranslations('ADE/AgentSimulator.HTILConfirmationInput');
  const { isLocal, agentId, isTemplate } = useCurrentAgentMetaData();

  const { onApprove, onDeny, message, mostRecentMessageId } = props;
  const toolName = useMemo(() => {
    return message.tool_call.name || '';
  }, [message.tool_call.name]);

  const hostConfig = useCurrentAPIHostConfig({
    isLocal,
    attachApiKey: false,
  });

  const getAcceptSnippet = useCallback(() => {
    return jsonToCurl({
      url: `${hostConfig.url}/v1/agents/${isTemplate ? 'your-agent-id' : agentId}/messages/stream`,
      headers: {
        ...hostConfig.headers,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: {
        messages: [
          {
            type: 'approval',
            approve: true,
            approval_request_id: mostRecentMessageId,
          },
        ],
      },
      method: 'POST',
    });
  }, [hostConfig, agentId, mostRecentMessageId, isTemplate]);

  const getRejectSnippet = useCallback(() => {
    return jsonToCurl({
      url: `${hostConfig.url}/v1/agents/${isTemplate ? 'your-agent-id' : agentId}/messages/stream`,
      headers: {
        ...hostConfig.headers,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: {
        messages: [
          {
            type: 'approval',
            approve: false,
            approval_request_id: mostRecentMessageId,
            reason: 'Cancelled by user',
          },
        ],
      },
      method: 'POST',
    });
  }, [hostConfig, agentId, mostRecentMessageId, isTemplate]);

  const { copyToClipboard: copyApproveCommand } = useCopyToClipboard({
    textToCopy: getAcceptSnippet(),
  });

  const { copyToClipboard: copyDenyCommand } = useCopyToClipboard({
    textToCopy: getRejectSnippet(),
  });

  return (
    <Frame position="relative" paddingX="medium" paddingBottom>
      <VStack gap={false} border padding fullWidth color="background-grey">
        <HStack align="center" justify="spaceBetween">
          <Badge variant="info" content={t('badge')} preIcon={<InfoIcon />} />
          <DropdownMenu
            align="end"
            triggerAsChild
            trigger={
              <Button
                color="tertiary"
                hideLabel
                size="xsmall"
                preIcon={<CopyIcon />}
                label={t('copyCommand')}
              />
            }
          >
            <DropdownMenuItem
              label={t('copyApprove')}
              onClick={() => {
                void copyApproveCommand();
              }}
            />
            <DropdownMenuItem
              label={t('copyDeny')}
              onClick={() => {
                void copyDenyCommand();
              }}
            />
          </DropdownMenu>
        </HStack>
        <VStack paddingTop="xsmall" fullWidth>
          <Typography variant="body2">
            {t('description', { toolName })}
          </Typography>
          {message.tool_call.arguments && (
            <VStack
              border
              className="max-h-[150px]"
              overflow="auto"
              padding="small"
            >
              <JSONViewer data={message.tool_call.arguments} />
            </VStack>
          )}

          <HStack>
            <Button
              size="small"
              color="secondary"
              onClick={onApprove}
              fullWidth
              label={t('approve')}
            />
            <Button
              size="small"
              color="secondary"
              onClick={onDeny}
              fullWidth
              label={t('deny')}
            />
          </HStack>
        </VStack>
      </VStack>
    </Frame>
  );
}
