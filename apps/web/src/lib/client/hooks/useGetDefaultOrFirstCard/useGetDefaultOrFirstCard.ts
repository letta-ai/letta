import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';

export function useGetDefaultOrFirstCard() {
  const { data } = webApi.organizations.getOrganizationPaymentMethods.useQuery({
    queryKey: webApiQueryKeys.organizations.getOrganizationPaymentMethods,
  });
  const defaultCard = useMemo(() => {
    if (!data?.body.creditCards) {
      return undefined;
    }

    return (
      data.body.creditCards.find((card) => card.isDefault) ||
      data.body.creditCards[0]
    );
  }, [data]);

  return defaultCard;
}
