import { useTranslations } from '@letta-cloud/translations';
import { Button, Popover, RocketIcon, Typography, VStack } from '@letta-cloud/ui-component-library';
import { CLOUD_UPSELL_URL } from '$web/constants';
import React from 'react';

export function CloudUpsellDeploy() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  return (
    <Popover
      triggerAsChild
      trigger={
        <Button
          size="default"
          color="primary"
          preIcon={<RocketIcon size="small" />}
          data-testid="trigger-cloud-upsell"
          label={t('CloudUpsellDeploy.trigger')}
        />
      }
      align="end"
    >
      <VStack padding="medium" gap="large">
        <VStack>
          <Typography variant="heading5" bold>
            {t('CloudUpsellDeploy.title')}
          </Typography>
          <Typography>{t('CloudUpsellDeploy.description')}</Typography>
          <Button
            fullWidth
            label={t('CloudUpsellDeploy.cta')}
            href={CLOUD_UPSELL_URL}
            color="primary"
          />
        </VStack>
      </VStack>
    </Popover>
  );
}
