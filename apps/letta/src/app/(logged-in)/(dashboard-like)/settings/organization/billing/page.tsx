'use client';
import { useTranslations } from 'next-intl';
import {
  Alert,
  brandKeyToLogo,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  isBrandKey,
} from '@letta-web/component-library';
import React, { useCallback, useMemo } from 'react';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ColumnDef } from '@tanstack/react-table';
import type { GetUsageByModelItem } from '$letta/web-api/usage/usageContract';

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function UsageTable() {
  const [monthCursor, setMonthCursor] = React.useState(new Date());

  const setPreviousMonth = useCallback(() => {
    setMonthCursor((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const setNextMonth = useCallback(() => {
    setMonthCursor((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  const startDate = useMemo(
    () => getStartOfMonth(monthCursor).getTime(),
    [monthCursor]
  );
  const endDate = useMemo(
    () => getEndOfMonth(monthCursor).getTime(),
    [monthCursor]
  );
  const t = useTranslations('organization/billing');

  const {
    data: usageSummary,
    isLoading,
    isError,
  } = webApi.usage.getUsageByModelSummary.useQuery({
    queryKey: webApiQueryKeys.usage.getUsageByModelSummary({
      startDate,
      endDate,
    }),
    queryData: {
      query: {
        startDate,
        endDate,
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
    [t]
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
            color="tertiary"
            label={t('UsageTable.previousMonth')}
            onClick={setPreviousMonth}
          />
          <Button
            color="tertiary"
            label={t('UsageTable.nextMonth')}
            onClick={setNextMonth}
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

function Members() {
  const t = useTranslations('organization/billing');

  return (
    <DashboardPageLayout encapsulatedFullHeight title={t('title')}>
      <DashboardPageSection>
        <Alert title={t('description')} variant="info" />
      </DashboardPageSection>
      <UsageTable />
    </DashboardPageLayout>
  );
}

export default Members;
