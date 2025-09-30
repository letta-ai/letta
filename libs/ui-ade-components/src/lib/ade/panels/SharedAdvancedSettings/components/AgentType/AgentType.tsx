import {
  HStack,
  InfoTooltip,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../../../../hooks';

export function AgentType() {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const { agent_type } = useCurrentAgent();

  return (
    <HStack align="center" fullWidth justify="spaceBetween">
      <HStack align="center">
        <Typography variant="body3" color="lighter" semibold={true}>
          {t('AgentType.label')}
        </Typography>
        <InfoTooltip text={t('AgentType.tooltip')} />
      </HStack>
      <Typography variant="body2" font="mono">
        {agent_type}
      </Typography>
    </HStack>
  );
}
