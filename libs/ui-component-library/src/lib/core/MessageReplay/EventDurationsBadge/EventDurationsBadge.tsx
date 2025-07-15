import { HStack } from '../../../framing/HStack/HStack';
import { Tooltip } from '../../Tooltip/Tooltip';
import { Typography } from '../../Typography/Typography';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';

interface EventDurationsBadgeProps {
  llmDuration?: number;
  toolDuration?: number;
  stepDuration?: number;
  lettaDuration?: number;
  totalDuration?: number;
  ttftDuration?: number;
}

interface DetailProps {
  label: string;
  info: string;
  value: string;
}

function Detail(props: DetailProps) {
  const { label, info, value } = props;

  return (
    <Tooltip content={info}>
      <HStack borderRight paddingX="small" gap="small">
        <Typography variant="body4" color="lighter">
          {value}
        </Typography>
        <Typography variant="body4" color="lighter">
          {label}
        </Typography>
      </HStack>
    </Tooltip>
  );
}

export function EventDurationsBadge(props: EventDurationsBadgeProps) {
  const t = useTranslations('components/MessageReplay/EventDurationsBadge');
  const {
    llmDuration,
    toolDuration,
    stepDuration,
    lettaDuration,
    ttftDuration,
    totalDuration,
  } = props;
  const { formatSmallDuration } = useFormatters();
  return (
    <HStack gap={false} borderY borderLeft color="background-grey2">
      {lettaDuration ? (
        <Detail
          label="Letta"
          value={formatSmallDuration(lettaDuration * 1000000)}
          info={t('lettaDurationTooltip')}
        />
      ) : null}
      {llmDuration ? (
        <Detail
          label="LLM"
          value={formatSmallDuration(llmDuration * 1000000)}
          info={t('llmDurationTooltip')}
        />
      ) : null}
      {toolDuration ? (
        <Detail
          label="Tool"
          value={formatSmallDuration(toolDuration * 1000000)}
          info={t('toolDurationTooltip')}
        />
      ) : null}
      {stepDuration ? (
        <Detail
          label="Step"
          value={formatSmallDuration(stepDuration * 1000000)}
          info={t('stepDurationTooltip')}
        />
      ) : null}
      {totalDuration ? (
        <Detail
          label={t('total')}
          value={formatSmallDuration(totalDuration * 1000000)}
          info={t('totalDurationTooltip')}
        />
      ) : null}
      {ttftDuration ? (
        <Detail
          label={t('ttft')}
          value={formatSmallDuration(ttftDuration * 1000000)}
          info={t('ttftDurationTooltip')}
        />
      ) : null}
    </HStack>
  );
}
