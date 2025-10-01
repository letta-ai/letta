'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  PlusIcon,
  Section,
  TabGroup,
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
import type { ColumnDef } from '@tanstack/react-table';
import { CreditCardSlot } from '$web/client/components';

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

type Tabs = 'billing-history'  | 'payment-methods';


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
  const [selectedTab, setSelectedTab] = React.useState<Tabs>('billing-history');

  const [canManageBilling] = useUserHasPermission(
    ApplicationServices.MANAGE_BILLING,
  );


  if (!canManageBilling) {
    return <Alert title={t('noPermission')} variant="destructive" />;
  }

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection>
        <Alert
          variant="info"
          title={t('lookingForUsage')}
          action={<Button href="/settings/organization/usage" size="small" label={t('goToUsage')} />}
        />
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
              label: t('BillingHistory.title'),
              value: 'billing-history',
            },
            {
              label: t('PaymentMethods.title'),
              value: 'payment-methods',
            },
          ]}
        />
        {selectedTab === 'billing-history' && <BillingHistory />}
        {selectedTab === 'payment-methods' && <PaymentMethods />}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default Billing;
