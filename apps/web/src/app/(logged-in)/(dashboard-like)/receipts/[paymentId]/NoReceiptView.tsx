'use client';

import {
  LoadingEmptyStatusComponent,
  Button,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export function NoReceiptView() {
  const t = useTranslations('receipts');

  return (
    <VStack fullWidth fullHeight align="center" justify="center" gap="medium">
      <LoadingEmptyStatusComponent
        emptyMessage={t('noReceiptFound')}
        isLoading={false}
        emptyAction={
          <Button
            label={t('returnToLetta')}
            href="/settings/organization/billing"
          ></Button>
        }
      />
    </VStack>
  );
}
