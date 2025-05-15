import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';

export function useGetDefaultOrFirstCard() {
  const { data: billingInfo } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const defaultCard = useMemo(() => {
    if (!billingInfo?.body.creditCards) {
      return undefined;
    }

    return (
      billingInfo.body.creditCards.find((card) => card.isDefault) ||
      billingInfo.body.creditCards[0]
    );
  }, [billingInfo]);

  return defaultCard;
}
