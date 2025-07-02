'use client';

import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { webApi } from '@letta-cloud/sdk-web';
import { isFetchError } from '@ts-rest/react-query/v5';
import { useCallback } from 'react';

interface ClonePageContentProps {
  agentName: string;
  agentId: string;
}

export function ClonePageContent(props: ClonePageContentProps) {
  const { agentName, agentId } = props;
  const t = useTranslations('agentfile/confirm');

  const { mutate, isPending, isSuccess } =
    webApi.agentfile.cloneAgentfile.useMutation({
      onError: (res) => {
        if (isFetchError(res)) {
          return;
        }

        if (res.status === 401) {
          window.location.href = `/login?redirect=${window.location.pathname}?startUse=true`;
        }
      },
      onSuccess: (data) => {
        window.location.href = data.body.redirectUrl;
      },
    });

  const handleAgentfileClone = useCallback(() => {
    mutate({
      params: {
        agentId: agentId || '',
      },
    });
  }, [agentId, mutate]);

  return (
    <VStack gap="large" paddingTop="small">
      <Typography>{t('title', { agentName })}</Typography>
      <HStack>
        <Button
          busy={isPending || isSuccess}
          onClick={() => {
            handleAgentfileClone();
          }}
          fullWidth
          label={t('confirm')}
        />
      </HStack>
    </VStack>
  );
}
