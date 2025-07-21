import { useTranslations } from '@letta-cloud/translations';
import { Badge } from '../../Badge/Badge';
import { HStack } from '../../../framing/HStack/HStack';
import { InfoTooltip } from '../../../reusable/InfoTooltip/InfoTooltip';

type StopReasonType =
  | 'cancelled'
  | 'end_turn'
  | 'error'
  | 'invalid_tool_call'
  | 'max_steps'
  | 'no_tool_call'
  | 'tool_rule';

interface StopReasonProps {
  stopReason: string;
}

export function StopReason(props: StopReasonProps) {
  const t = useTranslations('components/MessageReplay/StopReason');
  const { stopReason } = props;

  const getStopReasonTooltipText: Record<StopReasonType, string> = {
    end_turn: t('stopReasonToolTip.end_turn'),
    tool_rule: t('stopReasonToolTip.tool_rule'),
    error: t('stopReasonToolTip.error'),
    invalid_tool_call: t('stopReasonToolTip.invalid_tool_call'),
    no_tool_call: t('stopReasonToolTip.no_tool_call'),
    max_steps: t('stopReasonToolTip.max_steps'),
    cancelled: t('stopReasonToolTip.cancelled'),
  } as const;

  function getStopReasonBadgeVariant(
    stopReason: string,
  ): 'default' | 'destructive' | 'success' | 'warning' {
    switch (stopReason) {
      case 'end_turn':
      case 'tool_rule':
        return 'success';
      case 'error':
      case 'invalid_tool_call':
      case 'no_tool_call':
        return 'destructive';
      case 'max_steps':
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  }

  function isValidStopReason(reason: string): reason is StopReasonType {
    return reason in getStopReasonTooltipText;
  }

  // Get tooltip text with type safety
  const tooltipText = isValidStopReason(stopReason)
    ? getStopReasonTooltipText[stopReason]
    : t('stopReasonToolTip.default');

  return (
    <HStack>
      <Badge
        size="small"
        content={stopReason.replace('_', ' ').toUpperCase()}
        variant={getStopReasonBadgeVariant(stopReason)}
      />
      <InfoTooltip text={tooltipText} />
    </HStack>
  );
}
