import type { ProviderTrace } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import {
  Badge,
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
    return <Typography>{formatCurrency(creditsToDollars(cost))}</Typography>;
  }

  if (modelTier === 'free') {
    return (
      <HStack>
        <Badge
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
          variant="info"
          content={t('TransactionCost.premium.badge')}
        ></Badge>
        <InfoTooltip text={t('TransactionCost.premium.tooltip')} />
      </HStack>
    );
  }

  return <Typography>{formatCurrency(0)}</Typography>;
}

export function ResponseEvent(props: RequestEventProps) {
  const { responsePayload, stepId, traces, stopReason } = props;

  const t = useTranslations(
    'ADE/AgentSimulator/DetailedMessageView/TelemetryDetailsViewer/ResponseEvent',
  );

  const { formatNumber } = useFormatters();

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
        {!!traces && (
          <EventDetailRow
            label={t('attributes.cost')}
            value={<TransactionCost stepId={stepId} />}
          />
        )}
        {!!stopReason && (
          <EventDetailRow
            label={t('attributes.stopReason')}
            value={<StopReason stopReason={stopReason} />}
          />
        )}
      </VStack>
    </EventItem>
  );
}
