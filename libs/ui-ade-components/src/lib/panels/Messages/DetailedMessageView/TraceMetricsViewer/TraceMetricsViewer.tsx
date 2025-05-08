import { RawInputContainer, Section } from '@letta-cloud/ui-component-library';
import type { OtelTrace } from '@letta-cloud/types';
import React, { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';

interface TraceViewerProps {
  traces: OtelTrace[];
}

export function TraceMetricsViewer(props: TraceViewerProps) {
  const { traces } = props;

  const t = useTranslations('ADE/AgentSimulator/TraceMetricsViewer');

  const timeToFirstToken = useMemo(() => {
    return traces.find((trace) =>
      trace['Events.Name'].includes('time_to_first_token_ms'),
    )?.Duration;
  }, [traces]);

  const { formatNumber } = useFormatters();

  return (
    <Section title={t('title')}>
      {timeToFirstToken && (
        <RawInputContainer fullWidth label={t('timeToFirstToken.label')}>
          {t('timeToFirstToken.time', {
            time: formatNumber(timeToFirstToken / 1e9),
          })}
        </RawInputContainer>
      )}
    </Section>
  );
}
