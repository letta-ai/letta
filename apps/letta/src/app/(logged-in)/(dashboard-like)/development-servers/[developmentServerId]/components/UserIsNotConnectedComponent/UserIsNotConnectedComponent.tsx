import React from 'react';
import { Card, HStack, Typography } from '@letta-web/component-library';
import { ConnectToLocalServerCommand } from '$letta/client/components';
import { useTranslations } from 'next-intl';

export function UserIsNotConnectedComponent() {
  const t = useTranslations(
    'development-servers/components/UserIsNotConnectedComponent'
  );
  return (
    <Card>
      <Typography bold>{t('notConnected')}</Typography>
      <Typography>{t('start')}</Typography>
      <HStack paddingTop>
        <ConnectToLocalServerCommand />
      </HStack>
    </Card>
  );
}
