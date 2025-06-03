import {
  HStack,
  InfoTooltip,
  Skeleton,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useObservabilityContext } from '../hooks/useObservabilityContext/useObservabilityContext';
import { useFormatters } from '@letta-cloud/utils-client';
import { useCallback } from 'react';

interface DetailProps {
  label: string;
  tooltip?: string;
  value?: string | null;
}

function Detail(props: DetailProps) {
  const { label, value, tooltip } = props;
  return (
    <VStack gap={false}>
      <HStack>
        <Typography variant="body2">{label}</Typography>
        {tooltip && <InfoTooltip text={tooltip} />}
      </HStack>
      {typeof value === 'string' ? (
        <Typography variant="body2">{value}</Typography>
      ) : (
        <Skeleton
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-[50px] h-4"
        />
      )}
    </VStack>
  );
}

/*
 "totalMessages": {
      "label": "Total messages"
    },
    "totalTokenCount": {
      "label": "Total tokens"
    },
    "medianTokensPerMessage": {
      "label": "Median tokens per message"
    },
 "errorRate": {
      "label": "Error rate",
      "tooltip": "The error rate is the percentage of messages that resulted in an error. This includes tool errors and agent errors."
    },
    "p50TimeToFirstTokenMs": {
      "label": "Median time to first token",
      "tooltip": "The median time to first token is the median time it takes for an agent to generate the first token in response to a user message."
    },
    "p99TimeToFirstTokenMs": {
      "label": "99th percentile time to first token",
      "tooltip": "The 99th percentile time to first token is the time it takes for 99% of agents to generate the first token in response to a user message."
    },
    "p50ResponseTime": {
      "label": "Median response time",
      "tooltip": "The median response time is the median time it takes for an agent to respond to a user message."
    },
    "p99ResponseTime": {
      "label": "99th percentile response time",
      "tooltip": "The 99th percentile response time is the time it takes for 99% of agents to respond to a user message."
    }
 */
export function ObservabilityOverview() {
  const t = useTranslations(
    'pages/projects/observability/ObservabilityOverview',
  );
  const { startDate, endDate } = useObservabilityContext();

  const { id: projectId } = useCurrentProject();

  const { data } = webApi.observability.getObservabilityOverview.useQuery({
    queryKey: webApiQueryKeys.observability.getObservabilityOverview({
      projectId,
      startDate,
      endDate,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
      },
    },
  });

  const { formatNumber, formatSmallDuration } = useFormatters();

  const maybeNumber = useCallback(
    (d: unknown) => {
      if (typeof d !== 'number') {
        return null;
      }

      return formatNumber(d);
    },
    [formatNumber],
  );

  const maybePercentage = useCallback(
    (d: unknown) => {
      if (typeof d !== 'number') {
        return null;
      }

      return formatNumber(d, {
        style: 'percent',
      });
    },
    [formatNumber],
  );

  const maybeDuration = useCallback(
    (d: unknown) => {
      if (typeof d !== 'number') {
        return null;
      }

      return formatSmallDuration(d);
    },
    [formatSmallDuration],
  );

  return (
    <div className="min-w-[300px] w-[300px]">
      <VStack padding="xsmall">
        <VStack padding="medium">
          <HStack paddingBottom="medium">
            <Typography variant="body2" bold>
              {t('title')}
            </Typography>
          </HStack>
          <VStack gap="large">
            <Detail
              label={t('totalMessages.label')}
              value={maybeNumber(data?.body.totalMessageCount)}
            />
            {/*<Detail*/}
            {/*  label={t('totalTokenCount.label')}*/}
            {/*  value={maybeNumber(data?.body.totalTokenCount)}*/}
            {/*/>*/}
            {/*<Detail*/}
            {/*  label={t('medianTokensPerMessage.label')}*/}
            {/*  value={maybeNumber(data?.body.tokenPerMessageMedian)}*/}
            {/*/>*/}
            <Detail
              label={t('toolErrorRate.label')}
              value={maybePercentage(data?.body.toolErrorRate)}
              tooltip={t('toolErrorRate.tooltip')}
            />
            <Detail
              label={t('apiErrorRate.label')}
              value={maybePercentage(data?.body.apiErrorRate)}
              tooltip={t('apiErrorRate.tooltip')}
            />
            <Detail
              label={t('p50TimeToFirstTokenMs.label')}
              value={maybeDuration(data?.body.p50TimeToFirstTokenNs)}
              tooltip={t('p50TimeToFirstTokenMs.tooltip')}
            />
            <Detail
              label={t('p99TimeToFirstTokenMs.label')}
              value={maybeDuration(data?.body.p99TimeToFirstTokenNs)}
              tooltip={t('p99TimeToFirstTokenMs.tooltip')}
            />
            <Detail
              label={t('p50ResponseTime.label')}
              value={maybeDuration(data?.body.p50ResponseTimeNs)}
              tooltip={t('p50ResponseTime.tooltip')}
            />
            <Detail
              label={t('p99ResponseTime.label')}
              value={maybeDuration(data?.body.p99ResponseTimeNs)}
              tooltip={t('p99ResponseTime.tooltip')}
            />
          </VStack>
        </VStack>
      </VStack>
    </div>
  );
}
