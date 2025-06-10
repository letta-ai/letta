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

  const { formatNumber } = useFormatters();

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

  // const maybeDuration = useCallback(
  //   (d: unknown) => {
  //     if (typeof d !== 'number') {
  //       return null;
  //     }
  //
  //     return formatSmallDuration(d);
  //   },
  //   [formatSmallDuration],
  // );

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
            {/*<Detail*/}
            {/*  label={t('p50TimeToFirstTokenMs.label')}*/}
            {/*  value={maybeDuration(data?.body.p50TimeToFirstTokenNs)}*/}
            {/*  tooltip={t('p50TimeToFirstTokenMs.tooltip')}*/}
            {/*/>*/}
            {/*<Detail*/}
            {/*  label={t('p99TimeToFirstTokenMs.label')}*/}
            {/*  value={maybeDuration(data?.body.p99TimeToFirstTokenNs)}*/}
            {/*  tooltip={t('p99TimeToFirstTokenMs.tooltip')}*/}
            {/*/>*/}
            {/*<Detail*/}
            {/*  label={t('p50ResponseTime.label')}*/}
            {/*  value={maybeDuration(data?.body.p50ResponseTimeNs)}*/}
            {/*  tooltip={t('p50ResponseTime.tooltip')}*/}
            {/*/>*/}
            {/*<Detail*/}
            {/*  label={t('p99ResponseTime.label')}*/}
            {/*  value={maybeDuration(data?.body.p99ResponseTimeNs)}*/}
            {/*  tooltip={t('p99ResponseTime.tooltip')}*/}
            {/*/>*/}
          </VStack>
        </VStack>
      </VStack>
    </div>
  );
}
