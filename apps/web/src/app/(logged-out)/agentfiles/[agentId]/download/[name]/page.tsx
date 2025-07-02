'use client';
import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import {
  ArrowUpIcon,
  HStack,
  LettaInvaderOutlineIcon,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export default function DownloadPage() {
  const { agentId, name } = useParams<{ agentId: string; name: string }>();

  const t = useTranslations('agentfile/download');

  const mounted = useRef<boolean>(false);

  useEffect(() => {
    if (mounted.current) {
      return;
    }

    const downloadURL = `/api/agentfiles/${agentId}/download`;

    if (!name) {
      return;
    }

    void (async () => {
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

        mounted.current = true;
      } catch (_e) {
        return;
      }
    })();
  }, [agentId, name]);

  return (
    <div className="bg-background-grey3 w-[100dvw] h-[100dvh] overflow-hidden flex items-center justify-center">
      <div className="p-5 shadow-sm bg-background rounded-sm max-w-[400px] mx-auto flex overflow-auto items-center justify-center border">
        <div className="max-w-[350px] flex gap-2 flex-col w-full">
          <HStack gap="small">
            <LettaInvaderOutlineIcon />
            <ArrowUpIcon />
          </HStack>
          <Typography variant="body3">{t('downloadTitle')}</Typography>
        </div>
      </div>
    </div>
  );
}
