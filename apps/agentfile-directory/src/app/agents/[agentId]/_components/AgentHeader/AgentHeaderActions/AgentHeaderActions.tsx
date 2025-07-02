'use client';
import {
  Button,
  DownloadIcon,
  HStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { environment } from '@letta-cloud/config-environment-variables';

interface DownloadAgentButtonProps {
  agentId: string;
  agentName: string;
}

function DownloadAgentButton(props: DownloadAgentButtonProps) {
  const { agentId, agentName } = props;

  const t = useTranslations('pages/agent/AgentHeader.actions');

  return (
    <Button
      label={t('downloadAgent')}
      align="center"
      fullWidth
      href={`${environment.NEXT_PUBLIC_CURRENT_HOST}/agentfiles/${agentId}/download/${agentName}`}
      bold
      target="_blank"
      color="tertiary"
      preIcon={<DownloadIcon />}
      size="large"
    />
  );
}

interface AgentHeaderActionsProps {
  agentId: string;
  agentName: string;
}

export function AgentHeaderActions(props: AgentHeaderActionsProps) {
  const { agentId, agentName } = props;
  const t = useTranslations('pages/agent/AgentHeader.actions');

  return (
    <HStack>
      <DownloadAgentButton agentId={agentId} agentName={agentName} />
      <Button
        label={t('useInCloud')}
        align="center"
        fullWidth
        href={`${environment.NEXT_PUBLIC_CURRENT_HOST}/agentfiles/${agentId}/clone`}
        bold
        size="large"
      />
    </HStack>
  );
}
