import { useCurrentDevelopmentServerConfig } from '@letta-cloud/utils-client';
import React, { useCallback } from 'react';
import axios from 'axios';
import { Slot } from '@radix-ui/react-slot';
import { toast } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../hooks';
import { useCurrentAgentMetaData } from '../hooks';

interface ExportAgentButtonProps {
  trigger: React.ReactNode;
}

export function ExportAgentButton(props: ExportAgentButtonProps) {
  const { trigger } = props;

  const t = useTranslations('ExportAgentButton');
  const { isLocal } = useCurrentAgentMetaData();
  const { id: agentId, name } = useCurrentAgent();
  const config = useCurrentDevelopmentServerConfig();
  const handleAsyncDownload = useCallback(async () => {
    const downloadURL = isLocal
      ? `${config?.url}/v1/agents/${agentId}/export`
      : `/v1/agents/${agentId}/export`;

    try {
      const response = await axios.get(downloadURL, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));

      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', `${name}.af`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (_) {
      toast.error(t('error'));
    }
  }, [agentId, t, name, isLocal, config]);

  return <Slot onClick={handleAsyncDownload}>{trigger}</Slot>;
}
