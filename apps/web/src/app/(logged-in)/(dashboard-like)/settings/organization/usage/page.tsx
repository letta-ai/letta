'use client';
import { useMonthCursor } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { GetUsageByModelItem } from '@letta-cloud/sdk-web';
import type { ColumnDef } from '@tanstack/react-table';
import React, { useMemo } from 'react';
import {
  brandKeyToLogo,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  isBrandKey,
} from '@letta-cloud/ui-component-library';

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function UsageTable() {
  const {
    startOfMonth,
    cursor: monthCursor,
    moveToNextMonth,
    moveToPrevMonth,
    endOfMonth,
  } = useMonthCursor();

  const t = useTranslations('organization/usage');

  const {
    data: usageSummary,
    isLoading,
    isError,
  } = webApi.usage.getUsageByModelSummary.useQuery({
    queryKey: webApiQueryKeys.usage.getUsageByModelSummary({
      startDate: startOfMonth.getTime(),
      endDate: endOfMonth.getTime(),
    }),
    queryData: {
      query: {
        startDate: startOfMonth.getTime(),
        endDate: endOfMonth.getTime(),
      },
    },
  });

  const columns: Array<ColumnDef<GetUsageByModelItem>> = useMemo(
    () => [
      {
        header: t('UsageTable.model'),
        accessorKey: 'modelName',
        cell: ({ cell }) => {
          const { brand, modelName } = cell.row.original;
          return (
            <HStack>
              {isBrandKey(brand) ? brandKeyToLogo(brand) : ''}
              {modelName}
            </HStack>
          );
        },
      },
      {
        header: t('UsageTable.totalTokens'),
        accessorKey: 'totalTokens',
      },

      {
        header: t('UsageTable.totalRequests'),
        accessorKey: 'totalRequests',
      },
      {
        header: t('UsageTable.totalCost'),
        accessorKey: 'totalCost',
        cell: ({ cell }) => {
          return Intl.NumberFormat(undefined, {
            currency: 'USD',
            style: 'currency',
          }).format(cell.row.original.totalCost);
        },
      },
    ],
    [t],
  );

  const [limit, setLimit] = React.useState(10);
  const [offset, setOffset] = React.useState(0);
  const [search, setSearch] = React.useState('');

  const data = useMemo(() => {
    if (!usageSummary) {
      return [];
    }

    return usageSummary.body.slice(offset, offset + limit);
  }, [usageSummary, limit, offset]);

  const localeStringNiceStartDate = useMemo(() => {
    return getStartOfMonth(monthCursor).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      day: 'numeric',
    });
  }, [monthCursor]);

  const localeStringNiceEndDate = useMemo(() => {
    return getEndOfMonth(monthCursor).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      day: 'numeric',
    });
  }, [monthCursor]);

  const isAtCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      now.getFullYear() === monthCursor.getFullYear() &&
      now.getMonth() === monthCursor.getMonth()
    );
  }, [monthCursor]);

  return (
    <DashboardPageSection
      fullHeight
      title={t('UsageTable.title', {
        startDate: localeStringNiceStartDate,
        endDate: localeStringNiceEndDate,
      })}
      actions={
        <HStack>
          <Button
            color="secondary"
            label={t('UsageTable.previousMonth')}
            onClick={moveToPrevMonth}
          />
          <Button
            color="secondary"
            label={t('UsageTable.nextMonth')}
            onClick={moveToNextMonth}
            disabled={isAtCurrentMonth}
          />
        </HStack>
      }
    >
      <DataTable
        searchValue={search}
        showPagination
        onSearch={setSearch}
        columns={columns}
        data={data}
        limit={limit}
        offset={offset}
        isLoading={isLoading}
        errorMessage={isError ? t('UsageTable.error') : undefined}
        onSetOffset={setOffset}
        onLimitChange={setLimit}
        autofitHeight
      />
    </DashboardPageSection>
  );
}

function Usage() {
  const t = useTranslations('organization/usage');

  return (
    <DashboardPageLayout encapsulatedFullHeight title={t('title')}>
      <UsageTable />
    </DashboardPageLayout>
  );
}

export default Usage;
