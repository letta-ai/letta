'use client';
import {
  Button,
  DownloadIcon,
  HStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { environment } from '@letta-cloud/config-environment-variables';
import { useEffect, useState } from 'react';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface DownloadAgentButtonProps {
  agentId: string;
  agentName: string;
}

function DownloadAgentButton(props: DownloadAgentButtonProps) {
  const { agentId, agentName } = props;

  const t = useTranslations('pages/agent/AgentHeader.actions');

  function handleDownloadClick() {
    trackClientSideEvent(AnalyticsEvent.AGENTFILE_DOWNLOAD, {
      agentId,
    });
    // Open the download link
    window.open(
      `${environment.NEXT_PUBLIC_CURRENT_HOST}/agentfiles/${agentId}/download/${agentName}`,
      '_blank',
    );
  }

  return (
    <Button
      label={t('downloadAgent')}
      align="center"
      fullWidth
      bold
      color="tertiary"
      preIcon={<DownloadIcon />}
      size="large"
      onClick={handleDownloadClick}
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

  function handleUseInCloudClick() {
    trackClientSideEvent(AnalyticsEvent.AGENTFILE_USE_IN_LETTA_CLOUD, {
      agentId,
    });
    // Open the import link
    window.open(
      `${environment.NEXT_PUBLIC_CURRENT_HOST}/projects?import-agent=${agentId}`,
      '_blank',
    );
  }

  return (
    <HStack>
      <DownloadAgentButton agentId={agentId} agentName={agentName} />
      <Button
        label={t('useInCloud')}
        align="center"
        fullWidth
        bold
        size="large"
        onClick={handleUseInCloudClick}
      />
    </HStack>
  );
}
