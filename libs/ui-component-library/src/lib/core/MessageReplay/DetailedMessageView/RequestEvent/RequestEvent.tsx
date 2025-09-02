import type { ProviderTrace } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import {
  CopyButton,
  EventDetailRow,
  EventItem,
  HStack,
  InfoTooltip,
  MiddleTruncate,
  StartIcon,
  Tooltip,
  Typography,
  VStack,
} from '../../../../../';
import { useFormatters } from '@letta-cloud/utils-client';
import { RawDetailViewer } from '../RawDetailViewer/RawDetailViewer';

interface RequestEventProps {
  requestPayload: ProviderTrace['request_json'];
  responsePayload: ProviderTrace['response_json'];
  stepId: string;
  inputTokens?: number;
}

function getIfString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

interface Message {
  content: string;
  role: string;
}

function getIfMessages(value: unknown): Message[] | undefined {
  if (Array.isArray(value)) {
    return value as Message[];
  }

  return undefined;
}

interface Tools {
  function: {
    description: string;
    name: string;
    parameters: Record<string, unknown>;
    strict: boolean;
  };
  type: 'function';
}

function getIfTools(value: unknown): Tools[] | undefined {
  if (Array.isArray(value)) {
    return value as Tools[];
  }

  return undefined;
}

function getIfNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  return undefined;
}

export function RequestEvent(props: RequestEventProps) {
  const { requestPayload, responsePayload, inputTokens, stepId } = props;

  const t = useTranslations(
    'ADE/AgentSimulator/DetailedMessageView/TelemetryDetailsViewer/RequestEvent',
  );

  const model = getIfString(requestPayload?.model);
  const temperature = getIfNumber(requestPayload?.temperature);
  const toolChoice = getIfString(requestPayload?.toolChoice);

  const messages = getIfMessages(requestPayload?.messages);
  const tools = getIfTools(requestPayload?.tools);

  const { formatNumber, formatTokenSize } = useFormatters();

  return (
    <EventItem
      rightContent={
        <HStack gap={false} align="center">
          <HStack align="center">
            <Typography color="muted" variant="body3">
              <MiddleTruncate visibleStart={3} visibleEnd={10}>
                {stepId}
              </MiddleTruncate>
            </Typography>
            <CopyButton textToCopy={stepId} size="xsmall" hideLabel />
          </HStack>
          <RawDetailViewer
            requestPayload={requestPayload}
            responsePayload={responsePayload}
          />
        </HStack>
      }
      name={t('name')}
      icon={<StartIcon />}
    >
      <VStack gap={false} fullWidth>
        {model && (
          <EventDetailRow label={t('attributes.model')} value={model} />
        )}
        {inputTokens && (
          <EventDetailRow
            label={t('attributes.inputTokens')}
            value={
              <Tooltip
                content={t('tokens', { count: formatNumber(inputTokens) })}
              >
                <span>{formatTokenSize(inputTokens)}</span>
              </Tooltip>
            }
          />
        )}
        {temperature && (
          <EventDetailRow
            label={t('attributes.temperature')}
            value={`${temperature}`}
          />
        )}
        {toolChoice && (
          <EventDetailRow
            label={t('attributes.toolChoice')}
            value={toolChoice}
          />
        )}
        {messages && messages.length > 0 && (
          <EventDetailRow
            label={t('attributes.messages.label')}
            value={
              <HStack>
                {t('attributes.messages.value', { count: messages.length })}
                <InfoTooltip text={t('attributes.messages.tooltip')} />
              </HStack>
            }
          />
        )}
        {tools && tools.length > 0 && (
          <EventDetailRow
            label={t('attributes.tools.label')}
            value={t('attributes.tools.value', { count: tools.length })}
          />
        )}
      </VStack>
    </EventItem>
  );
}
