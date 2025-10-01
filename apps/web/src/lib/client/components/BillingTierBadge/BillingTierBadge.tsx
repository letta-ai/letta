import { Badge, type BadgeProps } from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';

interface BillingTierBadgeProps {
  size: BadgeProps['size']
}

export function BillingTierBadge(props: BillingTierBadgeProps) {
  const { size = 'large' } = props;
  const t = useTranslations('components/BillingTierBadge');

  const { data } = webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const billingTier = useMemo(() => {
    if (!data?.body.billingTier) {
      return null;
    }

    return data.body.billingTier;
  }, [data?.body.billingTier]);

  const tier = useMemo(() => {
    switch (billingTier) {
      case 'free':
        return t('tiers.free.title');
      case 'pro-legacy':
      case 'pro':
        return t('tiers.pro.title');
      case 'scale':
        return t('tiers.scale.title');
      case 'enterprise':
        return t('tiers.enterprise.title');
      default:
        return '';
    }
  }, [billingTier, t]);

  if (!billingTier) {
    return null;
  }

  return (
    <Badge
      border
      variant={billingTier !== 'free' ? 'info' : 'default'}
      content={tier}
      size={size}
    />
  )
}
