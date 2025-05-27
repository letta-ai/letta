import React, { useMemo, useState } from 'react';
import {
  Button,
  SideOverlay,
  CaretRightIcon,
  LoadingEmptyStatusComponent,
  VStack,
  SideOverlayHeader,
  Typography,
  HStack,
  Section,
  RawInput,
  RawInputContainer,
  Badge,
  InfoTooltip,
  TabGroup,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { Step } from '@letta-cloud/sdk-core';
import { useStepsServiceRetrieveStep } from '@letta-cloud/sdk-core';
import { useFormatters } from '@letta-cloud/utils-client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { ModelTiersType } from '@letta-cloud/types';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import { useCurrentAgentMetaData } from '../../../hooks';
import { TraceMetricsViewer } from './TraceMetricsViewer/TraceMetricsViewer';
import { TraceViewer } from './TraceViewer/TraceViewer';

interface StepBasicDetailsProps {
  step: Step;
}

function StepBasicDetails(props: StepBasicDetailsProps) {
  const t = useTranslations('ADE/AgentSimulator/DetailedMessageView');

  const { step } = props;
  const { id } = step;

  const { formatNumber } = useFormatters();

  return (
    <Section title={t('StepBasicDetails.title')}>
      <VStack gap="form" paddingY="xsmall">
        <RawInput
          label={t('StepBasicDetails.stepId')}
          value={id}
          readOnly
          fullWidth
          color="grey"
          allowCopy
        />
        <VStack gap="form" border padding="medium">
          <Typography bold>
            {t('StepBasicDetails.llmProviderDetails')}
          </Typography>
          <HStack>
            <RawInputContainer fullWidth label={t('StepBasicDetails.model')}>
              <Typography>{step.model}</Typography>
            </RawInputContainer>
            <RawInputContainer fullWidth label={t('StepBasicDetails.provider')}>
              <Typography>{step.provider_name}</Typography>
            </RawInputContainer>
          </HStack>
        </VStack>
        <VStack border padding="medium" gap="form">
          <Typography bold>{t('StepBasicDetails.tokenDetails')}</Typography>
          <HStack>
            <RawInputContainer
              fullWidth
              label={t('StepBasicDetails.promptTokens')}
            >
              <Typography>{formatNumber(step.prompt_tokens || 0)}</Typography>
            </RawInputContainer>
            <RawInputContainer
              fullWidth
              label={t('StepBasicDetails.totalTokens')}
            >
              <Typography>{formatNumber(step.total_tokens || 0)}</Typography>
            </RawInputContainer>
            <RawInputContainer
              fullWidth
              label={t('StepBasicDetails.completionTokens')}
            >
              <Typography>
                {formatNumber(step.completion_tokens || 0)}
              </Typography>
            </RawInputContainer>
          </HStack>
        </VStack>
      </VStack>
    </Section>
  );
}

interface TransactionCostProps {
  cost: number;
  modelTier: ModelTiersType;
}

function TransactionCost(props: TransactionCostProps) {
  const { cost, modelTier } = props;
  const t = useTranslations('ADE/AgentSimulator/DetailedMessageView');

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

interface TransactionDetailsProps {
  stepId: string;
}

function TransactionDetails(props: TransactionDetailsProps) {
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

  const t = useTranslations('ADE/AgentSimulator/DetailedMessageView');

  const transaction = useMemo(() => {
    return transactions?.body.transactions.find(
      (transaction) => transaction.stepId === stepId,
    );
  }, [transactions, stepId]);

  if (!transaction) {
    return null;
  }

  return (
    <Section title={t('TransactionDetails.title')}>
      <VStack gap="form" paddingY="xsmall">
        <RawInput
          label={t('TransactionDetails.transactionId')}
          value={transaction.id}
          readOnly
          fullWidth
          infoTooltip={{
            text: t('TransactionDetails.transactionIdTooltip'),
          }}
          color="grey"
          allowCopy
        />

        <RawInputContainer fullWidth label={t('TransactionDetails.cost')}>
          <TransactionCost
            cost={transaction.amount}
            modelTier={transaction.modelTier}
          />
        </RawInputContainer>
      </VStack>
    </Section>
  );
}

interface StepDetailsViewerProps {
  step: Step;
}

type DetailViewTypes = 'general' | 'raw' | 'replay';

function StepDetailsViewer(props: StepDetailsViewerProps) {
  const { step } = props;

  const { isLocal } = useCurrentAgentMetaData();
  const { data: traceData } = webApi.traces.getTrace.useQuery({
    queryKey: webApiQueryKeys.traces.getTrace(step.trace_id || ''),
    queryData: {
      params: {
        traceId: step.trace_id || '',
      },
    },
    enabled: !!step.trace_id,
  });

  const t = useTranslations('ADE/AgentSimulator/DetailedMessageView');

  const [detailsView, setDetailsView] = useState<DetailViewTypes>('general');

  return (
    <VStack
      paddingX
      collapseHeight
      flex
      fullWidth
      overflow="auto"
      paddingTop="small"
    >
      {!isLocal && (
        <TabGroup
          variant="chips"
          size="xxsmall"
          value={detailsView}
          onValueChange={(value) => {
            setDetailsView(value as DetailViewTypes);
          }}
          items={[
            {
              label: t('tabs.general'),
              value: 'general',
            },
            // {
            //   label: t('tabs.replay'),
            //   value: 'replay',
            // },
            {
              label: t('tabs.raw'),
              value: 'raw',
            },
          ]}
        />
      )}
      {detailsView === 'general' && (
        <>
          <StepBasicDetails step={step} />
          {!isLocal && <TransactionDetails stepId={step.id} />}
          {!isLocal && traceData && (
            <TraceMetricsViewer traces={traceData.body} />
          )}
        </>
      )}
      {detailsView === 'raw' && <TraceViewer traces={traceData?.body || []} />}
    </VStack>
  );
}

interface DetailedMessageViewProps {
  stepId: string;
}

export function DetailedMessageView(props: DetailedMessageViewProps) {
  const { stepId } = props;
  const t = useTranslations('ADE/AgentSimulator/DetailedMessageView');
  const [debugWindowOpen, setDebugWindowOpen] = useState(false);

  const { data } = useStepsServiceRetrieveStep(
    {
      stepId,
    },
    undefined,
    {
      enabled: debugWindowOpen,
    },
  );

  return (
    <>
      <Button
        preIcon={<CaretRightIcon />}
        onClick={() => {
          setDebugWindowOpen(true);
        }}
        size="xsmall"
        hideLabel
        square
        label={t('trigger')}
        property="square"
        color="tertiary"
      />

      <SideOverlay
        isOpen={debugWindowOpen}
        onOpenChange={setDebugWindowOpen}
        title={t('title')}
      >
        <VStack gap={false} fullWidth fullHeight>
          <SideOverlayHeader>
            <HStack paddingX="small" paddingY="xxsmall" align="center">
              <Typography variant="body2">{t('title')}</Typography> /{' '}
              <Typography variant="body2" bold>
                {stepId}
              </Typography>
            </HStack>
          </SideOverlayHeader>
          {!data ? (
            <LoadingEmptyStatusComponent
              loadingMessage={t('loading')}
              isLoading
            />
          ) : (
            <StepDetailsViewer step={data} />
          )}
        </VStack>
      </SideOverlay>
    </>
  );
}
