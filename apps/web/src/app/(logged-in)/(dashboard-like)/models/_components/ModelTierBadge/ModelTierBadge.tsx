import type { ModelTiersType } from '@letta-cloud/types';
import { Badge, HStack, InfoTooltip } from '@letta-cloud/ui-component-library';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';

interface ModelTierBadgeProps {
  tier: ModelTiersType;
}

export function ModelTierBadge(props: ModelTierBadgeProps) {
  const { tier } = props;
  const t = useTranslations('pages/models/ModelTierBadge');


  if (tier === 'free') {
    return <Badge variant="chipStandard" content={t('standard.label')} border />;
  }

  if (tier === 'premium') {
    return <Badge variant="chipPremium" content={t('premium.label')} border />;
  }

  return (
    <HStack>
      <Badge variant="default" content={t('perInference.label')}></Badge>
      <InfoTooltip
        text={t('perInference.tooltip', {
          requests: t('infinite'),
        })}
      />
    </HStack>
  );
}
