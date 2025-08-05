import type { ProviderTrace } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import {
  Badge,
  CopyButton,
  EndIcon,
  EventDetailRow,
  EventItem,
  HStack,
  InfoTooltip,
  Typography,
  VStack,
} from '../../../../../';
import { useFormatters } from '@letta-cloud/utils-client';
import type { ModelTiersType, OtelTrace } from '@letta-cloud/types';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import React, { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { StopReason } from '../../StopReason/StopReason';

interface RequestEventProps {
  responsePayload: ProviderTrace['response_json'];
  traces: OtelTrace[];
  stepId: string;
  stopReason: string;
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export function getIfUsage(value: unknown): Usage | undefined {
  if (typeof value === 'object' && value !== null) {
    return value as Usage;
  }
  return undefined;
}

interface TransactionCostProps {
  stepId: string;
}

function TransactionCost(props: TransactionCostProps) {
  const t = useTranslations(
    'ADE/AgentSimulator/DetailedMessageView/TelemetryDetailsViewer/ResponseEvent',
  );

  const { stepId } = props;
  const { data: transactions } = webApi.transactions.listTransactions.useQuery({
    queryKey: webApiQueryKeys.transactions.listTransactionsWithSearch({
      stepId,
    }),
    queryData: {
      query: {
        stepId,
      },
    },
  });

  const transaction = useMemo(() => {
    return transactions?.body.transactions.find(
      (transaction) => transaction.stepId === stepId,
    );
  }, [transactions, stepId]);

  const cost = transaction?.amount || 0;
  const modelTier: ModelTiersType = transaction?.modelTier || 'free';

  const { formatCurrency } = useFormatters();

  if (cost > 0) {
    return (
      <Typography variant="body2">
        {formatCurrency(creditsToDollars(cost))}
      </Typography>
    );
  }

  if (modelTier === 'free') {
    return (
      <HStack>
        <Badge
          size="small"
          variant="success"
          content={t('TransactionCost.standard.badge')}
        ></Badge>
        <InfoTooltip text={t('TransactionCost.standard.tooltip')} />
      </HStack>
    );
  }

  if (modelTier === 'premium') {
    return (
      <HStack>
        <Badge
          size="small"
          variant="info"
          content={t('TransactionCost.premium.badge')}
        ></Badge>
        <InfoTooltip text={t('TransactionCost.premium.tooltip')} />
      </HStack>
    );
  }

  return <Typography>{formatCurrency(0)}</Typography>;
}

interface LLMError {
  message: string;
}

function getLLMError(traces: OtelTrace[]): LLMError | undefined {
  const llmError = traces.find((trace) => {
    return trace.SpanName === 'LettaAgent._handle_llm_error';
  });

  if (!llmError) {
    return undefined;
  }

  return {
    message: llmError.StatusMessage,
  };
}

export function ResponseEvent(props: RequestEventProps) {
  const { responsePayload, stepId, traces, stopReason } = props;

  const t = useTranslations(
    'ADE/AgentSimulator/DetailedMessageView/TelemetryDetailsViewer/ResponseEvent',
  );

  const { formatNumber } = useFormatters();

  const llmError = useMemo(() => {
    return getLLMError(traces);
  }, [traces]);

  const usage = getIfUsage(responsePayload?.usage);

  return (
    <EventItem name={t('name')} icon={<EndIcon />}>
      <VStack gap={false} fullWidth>
        {usage?.output_tokens && (
          <EventDetailRow
            label={t('attributes.outputTokens')}
            value={formatNumber(usage.output_tokens)}
          />
        )}
        {!!stopReason && (
          <EventDetailRow
            label={t('attributes.stopReason')}
            value={<StopReason stopReason={stopReason} />}
          />
        )}
        {!!traces && (
          <EventDetailRow
            label={t('attributes.cost')}
            value={<TransactionCost stepId={stepId} />}
          />
        )}
        {!!llmError && (
          <VStack gap="small" padding="xxsmall">
            <HStack>
              <Typography variant="body3" bold>
                {t('attributes.llmError')}
              </Typography>
              <InfoTooltip text={t('attributes.llmErrorTooltip')} />
            </HStack>

            <VStack color="background-grey" padding="small" border fullWidth>
              <Typography font="mono" variant="body2">
                {llmError.message}
              </Typography>
              <HStack fullWidth justify="end">
                <CopyButton size="xsmall" textToCopy={llmError.message} />
              </HStack>
            </VStack>
          </VStack>
        )}
      </VStack>
    </EventItem>
  );
}
