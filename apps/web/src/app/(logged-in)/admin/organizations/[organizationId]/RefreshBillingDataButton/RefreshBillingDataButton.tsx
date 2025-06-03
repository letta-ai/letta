import { webApi } from '@letta-cloud/sdk-web';
import { useCallback } from 'react';
import { Button, toast } from '@letta-cloud/ui-component-library';
import { useCurrentAdminOrganization } from '../hooks/useCurrentAdminOrganization/useCurrentAdminOrganization';

export function RefreshBillingDataButton() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending } =
    webApi.admin.organizations.refreshBillingData.useMutation({
      onError: () => {
        toast.error(`Failed to refresh billing data`);
      },
      onSuccess: () => {
        toast.success('Billing data refreshed successfully');
      },
    });

  const handleRefresh = useCallback(() => {
    mutate({
      params: {
        organizationId: organization?.id || '',
      },
    });
  }, [mutate, organization?.id]);

  return (
    <Button
      size="small"
      busy={isPending}
      onClick={handleRefresh}
      label="Refresh stripe billing data"
    />
  );
}
