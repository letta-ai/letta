import { useCurrentAPIHostConfig } from '@letta-cloud/utils-client';
import React, { useCallback } from 'react';
import axios from 'axios';
import { Slot } from '@radix-ui/react-slot';
import { toast } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../hooks';
import { useADEState } from '../hooks/useADEState/useADEState';

interface ExportAgentButtonProps {
  trigger: React.ReactNode;
}

export function ExportAgentButton(props: ExportAgentButtonProps) {
  const { trigger } = props;

  const t = useTranslations('ExportAgentButton');
  const { isLocal } = useADEState();
  const { id: agentId, name } = useCurrentAgent();
  const config = useCurrentAPIHostConfig({
    isLocal,
  });
  const handleAsyncDownload = useCallback(async () => {
    const downloadURL = isLocal
      ? `${config?.url}/v1/agents/${agentId}/export`
      : `/v1/agents/${agentId}/export`;

    try {
      const response = await axios.get(downloadURL, {
        responseType: 'blob',
        ...(isLocal ? { headers: config.headers } : {}),
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));

      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', `${name}.af`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error(t('error'));
    }
  }, [agentId, t, name, isLocal, config]);

  if (!agentId) {
    return null;
  }

  return <Slot onClick={handleAsyncDownload}>{trigger}</Slot>;
}
