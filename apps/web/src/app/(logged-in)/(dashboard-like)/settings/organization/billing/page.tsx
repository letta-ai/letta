'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  PlusIcon,
  Section,
  TabGroup,
  TollIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useMemo, useState } from 'react';
import { webApi, webApiQueryKeys } from '$web/client';
import type { BillingHistorySchemaType } from '$web/web-api/contracts';
import { useFormatters } from '@letta-cloud/utils-client';
import { AddCreditCardDialog } from '$web/client/components/AddCreditCardDialog/AddCreditCardDialog';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { PurchaseCreditsDialog } from '$web/client/components/PurchaseCreditsDialog/PurchaseCreditsDialog';
import type { ColumnDef } from '@tanstack/react-table';
import { CreditCardSlot } from '$web/client/components';
import type { BillingTiersType } from '@letta-cloud/types';
import { UpgradePlanDialog } from '$web/client/components/UpgradePlanDialog/UpgradePlanDialog';
import { CancelPlanDialog } from '$web/client/components/CancelPlanDialog/CancelPlanDialog';
import { ResumePlanButton } from '$web/client/components/ResumePlanButton/ResumePlanButton';
import { CustomerQuotaView } from '$web/client/components/CustomerQuotaView/CustomerQuotaView';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import { Voxel } from './Voxel';

function ManagePlanButton() {
  const t = useTranslations('organization/billing');

  return (
    <Button
      color="secondary"
      bold
      size="small"
      href="/upgrade/support"
      label={t('SubscribedView.manage')}
    />
  );
}

interface ProViewProps {
  billingPeriodEnd: string | undefined;
  isCancelled: boolean;
}

function SubscribedView(props: ProViewProps) {
  const { billingPeriodEnd, isCancelled } = props;
  const t = useTranslations('organization/billing');
  const { formatDate } = useFormatters();

  if (!billingPeriodEnd) {
    return (
      <HStack>
        <ManagePlanButton />
        <CancelPlanDialog
          trigger={
            <Button
              color="tertiary"
              bold
              size="small"
              label={t('SubscribedView.cancel')}
            />
          }
        />
      </HStack>
    );
  }

  if (isCancelled) {
    return (
      <VStack>
        <Typography>
          {t('SubscribedView.cancelPeriod', {
            date: formatDate(billingPeriodEnd),
          })}
        </Typography>
        <HStack>
          <ResumePlanButton />
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack>
      <Typography>
        {t('SubscribedView.billingPeriod', {
          date: formatDate(billingPeriodEnd),
        })}
      </Typography>
      <HStack>
        <ManagePlanButton />

        <CancelPlanDialog
          trigger={
            <Button
              color="tertiary"
              bold
              size="small"
              label={t('SubscribedView.cancel')}
            />
          }
        />
      </HStack>
    </VStack>
  );
}

interface AccountDetailsCTAProps {
  billingTier: BillingTiersType;
  billingPeriodEnd: string | undefined;
  isCancelled: boolean;
}

function AccountDetailsCTA(props: AccountDetailsCTAProps) {
  const { billingTier, billingPeriodEnd, isCancelled } = props;

  switch (billingTier) {
    case 'free':
      return <HStack></HStack>;
    case 'pro-legacy':
    case 'scale':
      return (
        <SubscribedView
          billingPeriodEnd={billingPeriodEnd}
          isCancelled={isCancelled}
        />
      );
  }
}

function Arrows() {
  return (
    <svg
      width="48"
      height="24"
      viewBox="0 0 48 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 10.78C15.86 10.78 16.22 11.14 16.22 12C16.22 12.88 15.86 13.24 15 13.24C13.82 13.24 13.34 13.72 13.34 14.9C13.34 15.76 12.98 16.12 12.1 16.12C10.94 16.12 10.46 16.62 10.46 17.78C10.46 18.64 10.1 19 9.22 19C8.36 19 8 18.64 8 17.78C8 16.9 8.36 16.54 9.22 16.54C10.38 16.54 10.88 16.06 10.88 14.9V9.12C10.88 7.96 10.38 7.48 9.22 7.48C8.36 7.48 8 7.12 8 6.24C8 5.38 8.36 5 9.22 5C10.1 5 10.46 5.38 10.46 6.24C10.46 7.4 10.94 7.9 12.1 7.9C12.98 7.9 13.34 8.26 13.34 9.12C13.34 10.3 13.82 10.78 15 10.78Z"
        fill="hsl(var(--border))"
      />
      <path
        d="M27 10.78C27.86 10.78 28.22 11.14 28.22 12C28.22 12.88 27.86 13.24 27 13.24C25.82 13.24 25.34 13.72 25.34 14.9C25.34 15.76 24.98 16.12 24.1 16.12C22.94 16.12 22.46 16.62 22.46 17.78C22.46 18.64 22.1 19 21.22 19C20.36 19 20 18.64 20 17.78C20 16.9 20.36 16.54 21.22 16.54C22.38 16.54 22.88 16.06 22.88 14.9V9.12C22.88 7.96 22.38 7.48 21.22 7.48C20.36 7.48 20 7.12 20 6.24C20 5.38 20.36 5 21.22 5C22.1 5 22.46 5.38 22.46 6.24C22.46 7.4 22.94 7.9 24.1 7.9C24.98 7.9 25.34 8.26 25.34 9.12C25.34 10.3 25.82 10.78 27 10.78Z"
        fill="hsl(var(--border))"
      />
      <path
        d="M39 10.78C39.86 10.78 40.22 11.14 40.22 12C40.22 12.88 39.86 13.24 39 13.24C37.82 13.24 37.34 13.72 37.34 14.9C37.34 15.76 36.98 16.12 36.1 16.12C34.94 16.12 34.46 16.62 34.46 17.78C34.46 18.64 34.1 19 33.22 19C32.36 19 32 18.64 32 17.78C32 16.9 32.36 16.54 33.22 16.54C34.38 16.54 34.88 16.06 34.88 14.9V9.12C34.88 7.96 34.38 7.48 33.22 7.48C32.36 7.48 32 7.12 32 6.24C32 5.38 32.36 5 33.22 5C34.1 5 34.46 5.38 34.46 6.24C34.46 7.4 34.94 7.9 36.1 7.9C36.98 7.9 37.34 8.26 37.34 9.12C37.34 10.3 37.82 10.78 39 10.78Z"
        fill="hsl(var(--border))"
      />
    </svg>
  );
}

function FreePlanUpsellDetails() {
  const t = useTranslations('organization/billing');

  return (
    <VStack position="relative" border fullWidth color="brand" padding="xlarge">
      <HStack
        position="relative"
        /* eslint-disable-next-line react/forbid-component-props */
        className="z-[1]"
        fullWidth
        align="center"
        justify="spaceBetween"
      >
        <HStack align="center" gap="small">
          <Typography
            /* eslint-disable-next-line react/forbid-component-props */
            style={{ color: 'hsl(var(--border))' }}
            variant="heading4"
            bold
          >
            {t('FreePlanUpsellDetails.title')}
          </Typography>
          <Arrows />
        </HStack>
        <UpgradePlanDialog
          trigger={
            <Button
              _use_rarely_className="bg-white text-black"
              data-testid="upgrade-to-pro"
              bold
              label={t('AccountDetailsCTA.upgrade')}
            />
          }
        />
      </HStack>
      <div style={{ right: 100 }} className="h-full absolute top-0">
        <Voxel />
      </div>
    </VStack>
  );
}

function SubscriptionDetails() {
  const t = useTranslations('organization/billing');

  const { data } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const description = useMemo(() => {
    switch (data?.body.billingTier) {
      case 'free':
        return t('SubscriptionDetails.description.free');
      case 'pro-legacy':
        return t('SubscriptionDetails.description.pro');
      case 'scale':
        return t('SubscriptionDetails.description.scale');
      case 'enterprise':
        return t('SubscriptionDetails.description.enterprise');
    }
  }, [data, t]);

  if (!data) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  if (data.body.billingTier === 'free') {
    return null;
  }

  return (
    <Section title={t('SubscriptionDetails.title')}>
      <Typography data-testid="subscription-details">{description}</Typography>
      <AccountDetailsCTA
        billingPeriodEnd={data.body.billingPeriodEnd}
        isCancelled={data.body.isCancelled}
        billingTier={data.body.billingTier}
      />
    </Section>
  );
}

function PaymentMethods() {
  const { data, isLoading, isError } =
    webApi.organizations.getOrganizationPaymentMethods.useQuery({
      queryKey: webApiQueryKeys.organizations.getOrganizationPaymentMethods,
    });

  const t = useTranslations('organization/billing');

  if (!data) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        isError={isError}
        errorMessage={t('BillingOverview.error')}
      />
    );
  }

  return (
    <Section
      title={t('PaymentMethods.title')}
      description={t('PaymentMethods.description')}
      actions={
        data.body.creditCards.length > 0 &&
        data.body.creditCards.length < 4 && (
          <AddCreditCardDialog
            trigger={
              <Button
                preIcon={<PlusIcon />}
                label={t('PaymentMethods.addPaymentMethod')}
                color="primary"
              />
            }
          />
        )
      }
    >
      <VStack position="relative">
        {data.body.creditCards.length === 0 && (
          <VStack
            padding="xxlarge"
            color="background-grey"
            fullWidth
            align="center"
          >
            <Typography>{t('PaymentMethods.noPaymentMethods')}</Typography>
            <AddCreditCardDialog
              trigger={
                <Button
                  id="add-payment-method"
                  label={t('PaymentMethods.addPaymentMethod')}
                  color="primary"
                  size="small"
                />
              }
            />
          </VStack>
        )}
        <VStack paddingY="small">
          <NiceGridDisplay itemWidth="400px">
            {data.body.creditCards.map((creditCard) => (
              <CreditCardSlot key={creditCard.id} creditCard={creditCard} />
            ))}
          </NiceGridDisplay>
        </VStack>
      </VStack>
    </Section>
  );
}

type Tabs = 'billing-history' | 'overview' | 'payment-methods';

function BillingOverview() {
  const { data, isLoading, isError } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  const t = useTranslations('organization/billing');

  const { formatCurrency } = useFormatters();

  const showCreditsViewer = useMemo(() => {
    if (data?.body.billingTier !== 'free') {
      return true;
    }

    if (data?.body.totalCredits > 0) {
      return true;
    }

    return false;
  }, [data]);

  if (!data) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        isError={isError}
        errorMessage={t('BillingOverview.error')}
      />
    );
  }

  return (
    <VStack gap="large" width="largeContained">
      {data.body.billingTier === 'free' && <FreePlanUpsellDetails />}
      {data.body.billingTier !== 'enterprise' && <CustomerQuotaView />}
      {showCreditsViewer && (
        <Section
          title={t('BillingOverview.Credits.title')}
          description={t('BillingOverview.Credits.description')}
        >
          <VStack color="background-grey" border padding>
            <VStack paddingY="small" align="start">
              <HStack align="end">
                <HStack align="center">
                  <Typography>
                    <HStack as="span" align="end">
                      {t.rich('BillingOverview.Credits.used', {
                        total: () => (
                          <Typography
                            variant="heading2"
                            /* eslint-disable-next-line react/forbid-component-props */
                            className="leading-none"
                            data-testid="total-credits"
                            overrideEl="span"
                            bold
                          >
                            {formatCurrency(
                              creditsToDollars(data.body.totalCredits),
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </Typography>
                        ),
                      })}
                    </HStack>
                  </Typography>
                </HStack>
              </HStack>
            </VStack>
            <HStack>
              <PurchaseCreditsDialog
                trigger={
                  <Button
                    preIcon={<TollIcon />}
                    label={t('BillingOverview.Credits.add')}
                    color="primary"
                  />
                }
              />
            </HStack>
          </VStack>
        </Section>
      )}
      <SubscriptionDetails />
    </VStack>
  );
}

const limit = 10;

function BillingHistory() {
  const t = useTranslations('organization/billing');

  const { data, isFetchingNextPage, fetchNextPage, hasNextPage } =
    webApi.organizations.getOrganizationBillingHistory.useInfiniteQuery({
      queryKey:
        webApiQueryKeys.organizations.getOrganizationBillingHistoryWithSearch({
          limit,
        }),
      queryData: ({ pageParam }) => ({
        query: {
          cursor: pageParam?.cursor,
          limit,
        },
      }),
      initialPageParam: { cursor: '' },
      getNextPageParam: (lastPage) => {
        if (!lastPage.body.nextCursor) {
          return undefined;
        }

        return {
          cursor: lastPage.body.nextCursor,
        };
      },
    });

  const { formatDate, formatCurrency } = useFormatters();

  const columns: Array<ColumnDef<BillingHistorySchemaType>> = useMemo(() => {
    return [
      {
        header: t('BillingHistory.columns.date'),
        accessorKey: 'createdAt',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        header: t('BillingHistory.columns.description'),
        accessorKey: 'description',
      },
      {
        header: t('BillingHistory.columns.amount'),
        accessorKey: 'amount',
        cell: ({ row }) =>
          formatCurrency(row.original.amount, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          }),
      },
      {
        header: t('BillingHistory.columns.receipt'),
        accessorKey: 'receipt',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => (
          <Button
            label={t('BillingHistory.viewReceipt')}
            color="secondary"
            href={row.original.receiptLink}
            target="_blank"
            size="small"
          />
        ),
      },
    ];
  }, [t, formatCurrency, formatDate]);

  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const currentPage = useMemo(
    () => data?.pages[page].body.history || [],
    [data, page],
  );

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  return (
    <DataTable
      columns={columns}
      data={currentPage}
      page={page}
      onSetPage={setPage}
      loadingText={t('BillingHistory.loading')}
      noResultsText={t('BillingHistory.noBillingHistory')}
      isLoading={isLoadingPage}
      hasNextPage={hasNextPage}
      showPagination
      limit={limit}
    />
  );
}

function Billing() {
  const t = useTranslations('organization/billing');
  const [selectedTab, setSelectedTab] = React.useState<Tabs>('overview');

  const [canManageBilling] = useUserHasPermission(
    ApplicationServices.MANAGE_BILLING,
  );

  if (!canManageBilling) {
    return <Alert title={t('noPermission')} variant="destructive" />;
  }

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection>
        <TabGroup
          color="transparent"
          extendBorder
          onValueChange={(value) => {
            setSelectedTab(value as Tabs);
          }}
          size="small"
          value={selectedTab}
          items={[
            {
              label: t('Overview.title'),
              value: 'overview',
            },
            {
              label: t('BillingHistory.title'),
              value: 'billing-history',
            },
            {
              label: t('PaymentMethods.title'),
              value: 'payment-methods',
            },
          ]}
        />
        {selectedTab === 'overview' && <BillingOverview />}
        {selectedTab === 'billing-history' && <BillingHistory />}
        {selectedTab === 'payment-methods' && <PaymentMethods />}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default Billing;
