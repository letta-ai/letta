'use client';
import { useEffect } from 'react';
import { useCurrentOrganization, useCurrentUser } from '$web/client/hooks';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

export function AppCues() {
  const user = useCurrentUser();
  const { data: billingData } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const organization = useCurrentOrganization();
  useEffect(() => {
    if (!user || !billingData || !organization) {
      return;
    }

    try {
      // only run this on app.letta.com
      if (process.env.NODE_ENV !== 'production') {
        return;
      }

      if (!window.Appcues) {
        console.error('Appcues is not loaded');
        return;
      }

      const name = user.name || 'User';
      const [firstName, lastName] = name.split(' ');
      window.Appcues.identify(user.id, {
        firstName,
        lastName,
        createdAt: new Date(user.createdAt).getTime(),
        email: user.email,
        accountId: organization.id,
      });

      window.Appcues.group(organization.id, {
        planTier: billingData.body.billingTier,
        companyName: organization.name,
        email: user.email,
        language: user.locale,
        renewalDate: billingData.body.billingPeriodEnd
          ? new Date(billingData.body.billingPeriodEnd).getTime()
          : null,
      });
    } catch (_e) {
      // Appcues is not loaded yet, so we can ignore this error
      console.log('fasfs', _e);
    }
  }, [user, billingData, organization]);

  if (process.env.NODE_ENV !== 'production') {
    return null; // Do not render AppCues in non-production environments
  }

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.AppcuesSettings = {enableURLDetection: true};`,
        }}
        type="text/javascript"
      ></script>
      <script async src="//fast.appcues.com/223023.js"></script>
    </>
  );
}
