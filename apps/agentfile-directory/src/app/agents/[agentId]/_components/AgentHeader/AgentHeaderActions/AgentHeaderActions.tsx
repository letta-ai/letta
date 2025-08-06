'use client';
import {
  Button,
  DownloadIcon,
  HStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { environment } from '@letta-cloud/config-environment-variables';
import { useEffect, useState } from 'react';

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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <HStack>
      <DownloadAgentButton agentId={agentId} agentName={agentName} />
      <Button
        label={t('useInCloud')}
        align="center"
        fullWidth
        href={`${environment.NEXT_PUBLIC_CURRENT_HOST}/projects?import-agent=${agentId}`}
        bold
        target="_blank"
        size="large"
      />
    </HStack>
  );
}
