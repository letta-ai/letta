'use client';
import { useCurrentAdminOrganization } from './hooks/useCurrentAdminOrganization/useCurrentAdminOrganization';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  RawInput,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { webApi } from '$letta/client';
import { useCallback } from 'react';

function EnableCloudAccess() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending, isError } =
    webApi.admin.organizations.toggleCloudOrganization.useMutation();

  const handleEnableCloudAccess = useCallback(() => {
    mutate({
      params: {
        organizationId: organization?.id || '',
      },
      body: {
        enabledCloud: true,
      },
    });
  }, [organization, mutate]);

  return (
    <Dialog
      title="Enable Cloud Access"
      trigger={<Button label="Enable Cloud Access" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to enable cloud access' : undefined}
      onConfirm={handleEnableCloudAccess}
    >
      <p>Are you sure you want to enable cloud access for this organization?</p>
    </Dialog>
  );
}

function DisableCloudAccess() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending, isError } =
    webApi.admin.organizations.toggleCloudOrganization.useMutation();

  const handleDisableCloudAccess = useCallback(() => {
    mutate({
      params: {
        organizationId: organization?.id || '',
      },
      body: {
        enabledCloud: false,
      },
    });
  }, [organization, mutate]);

  return (
    <Dialog
      title="Disable Cloud Access"
      trigger={<Button label="Disable Cloud Access" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to disable cloud access' : undefined}
      onConfirm={handleDisableCloudAccess}
    >
      <p>
        Are you sure you want to disable cloud access for this organization?
        This wont delete any data.
      </p>
    </Dialog>
  );
}

function OrganizationPage() {
  const organization = useCurrentAdminOrganization();

  return (
    <DashboardPageLayout title={organization?.name}>
      <DashboardPageSection title="Organization Details">
        <RawInput disabled fullWidth label="Name" value={organization?.name} />
      </DashboardPageSection>
      <DashboardPageSection title="Cloud Access">
        <VStack>
          <Typography>
            Currently cloud access is{' '}
            {organization?.enabledCloudAt ? 'enabled' : 'disabled'} for this
            organization.
          </Typography>
          <div>
            {organization?.enabledCloudAt ? (
              <DisableCloudAccess />
            ) : (
              <EnableCloudAccess />
            )}
          </div>
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default OrganizationPage;
