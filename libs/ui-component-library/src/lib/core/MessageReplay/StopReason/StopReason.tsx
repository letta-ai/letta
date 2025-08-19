import { useTranslations } from '@letta-cloud/translations';
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

  const stopReasonTextMap: Record<StopReasonType, string> = {
    end_turn: t('stopReasonText.end_turn'),
    tool_rule: t('stopReasonText.tool_rule'),
    error: t('stopReasonText.error'),
    invalid_tool_call: t('stopReasonText.invalid_tool_call'),
    no_tool_call: t('stopReasonText.no_tool_call'),
    max_steps: t('stopReasonText.max_steps'),
    cancelled: t('stopReasonText.cancelled'),
  } as const;

  function isValidStopReason(reason: string): reason is StopReasonType {
    return reason in getStopReasonTooltipText;
  }

  function isValidStopReasonText(
    reason: string,
  ): reason is keyof typeof stopReasonTextMap {
    return reason in stopReasonTextMap;
  }

  // Get tooltip text with type safety
  const tooltipText = isValidStopReason(stopReason)
    ? getStopReasonTooltipText[stopReason]
    : t('stopReasonToolTip.default');

  const stopReasonText = isValidStopReasonText(stopReason)
    ? stopReasonTextMap[stopReason]
    : t('stopReasonText.unknown');

  return (
    <HStack>
      {stopReasonText}
      <InfoTooltip text={tooltipText} />
    </HStack>
  );
}
