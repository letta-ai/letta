import type { RunResponse } from '../../../../../../hooks';
import { HStack, Typography } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface RunDetailsProps {
  run: RunResponse['run']
}

export function RunDetails(props: RunDetailsProps) {
  const { run } = props;

  const t = useTranslations('AgentMessenger/RunDetails');

  const { stop_reason } = run;

  if (!stop_reason) {
    return null;
  }

  return (
    <HStack>
      <Typography color="muted" variant="body4">
        {t('stopReason', {
          reason: stop_reason
        })}
      </Typography>

    </HStack>
  )

}
