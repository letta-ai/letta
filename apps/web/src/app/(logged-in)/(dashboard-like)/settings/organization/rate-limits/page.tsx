'use client';
import { useEffect, useMemo, useState } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import type { RateLimit } from '@letta-cloud/web-api-client';
import { useTranslations } from '@letta-cloud/translations';
import {
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  TabGroup,
} from '@letta-cloud/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import { useNumberFormatter } from '@letta-cloud/helpful-client-utils';
import { useDebouncedValue } from '@mantine/hooks';

type Mode = 'embedding' | 'inference';

function RateLimitsPage() {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState<number>();
  const [mode, setMode] = useState<Mode>('inference');

  const t = useTranslations('organization/rate-limits');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data: inferenceRateLimits } =
    webApi.rateLimits.getInferenceRateLimits.useQuery({
      queryKey: webApiQueryKeys.rateLimits.getInferenceRateLimitsWithSearch({
        search: debouncedSearch,
        offset,
        limit,
      }),
      queryData: {
        query: {
          search: debouncedSearch,
          offset,
          limit,
        },
      },
      enabled: !!(mode === 'inference' && limit),
    });

  const { data: embeddingRateLimits } =
    webApi.rateLimits.getEmbeddingRateLimits.useQuery({
      queryKey: webApiQueryKeys.rateLimits.getEmbeddingRateLimitsWithSearch({
        search,
        offset,
        limit,
      }),
      queryData: {
        query: {
          search,
          offset,
          limit,
        },
      },
      enabled: !!(mode === 'embedding' && limit),
    });

  const rateLimit = useMemo(() => {
    return mode === 'inference' ? inferenceRateLimits : embeddingRateLimits;
  }, [mode, inferenceRateLimits, embeddingRateLimits]);

  const { formatNumber } = useNumberFormatter();

  const columns: Array<ColumnDef<RateLimit>> = useMemo(() => {
    return [
      {
        header: t('columns.name'),
        accessorKey: 'model',
      },
      {
        header: t('columns.tokensPerMinute'),
        accessorKey: 'tokensPerMinute',
        cell: ({ row }) => formatNumber(row.original.tokensPerMinute),
      },
      {
        header: t('columns.requestsPerMinute'),
        accessorKey: 'requestsPerMinute',
        cell: ({ row }) => formatNumber(row.original.requestsPerMinute),
      },
    ];
  }, [t, formatNumber]);

  useEffect(() => {
    setOffset(0);
  }, [mode, debouncedSearch]);

  return (
    <DashboardPageLayout
      title={t('title')}
      encapsulatedFullHeight
      subtitle={t('description')}
    >
      <DashboardPageSection fullHeight>
        <TabGroup
          extendBorder
          onValueChange={(value) => {
            setMode(value as Mode);
          }}
          value={mode}
          items={[
            {
              label: t('tabs.inference'),
              value: 'inference',
            },
            {
              label: t('tabs.embeddings'),
              value: 'embedding',
            },
          ]}
        />
        <DataTable
          autofitHeight
          searchValue={search}
          showPagination
          onSearch={setSearch}
          offset={offset}
          limit={limit}
          onSetOffset={setOffset}
          onLimitChange={setLimit}
          hasNextPage={rateLimit?.body.hasNextPage}
          columns={columns}
          data={rateLimit?.body.rateLimits || []}
          isLoading={!rateLimit?.body.rateLimits}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default RateLimitsPage;
