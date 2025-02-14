'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useDebouncedValue } from '@mantine/hooks';
import type { ColumnDef } from '@tanstack/react-table';
import type { CostItemType } from '@letta-cloud/web-api-client';
import {
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
} from '@letta-cloud/component-library';

function CostExplorer() {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState<number>();

  const t = useTranslations('organization/costs');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data: costs } = webApi.costs.getStepCosts.useQuery({
    queryKey: webApiQueryKeys.costs.getStepCostsWithSearch({
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
    enabled: !!limit,
  });

  const columns: Array<ColumnDef<CostItemType>> = useMemo(() => {
    if (!costs) {
      return [];
    }

    const nextColumns = [
      {
        id: 'modelName',
        header: t('columns.name'),
        accessorKey: 'modelName',
      },
    ];

    const columnSet = new Set<string>();

    costs.body.stepCosts.forEach((cost) => {
      Object.keys(cost.costMap).forEach((windowSize) => {
        columnSet.add(windowSize);
      });
    });

    const windowSizesSorted = Array.from(columnSet).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    );

    return [
      ...nextColumns,
      ...windowSizesSorted.map((windowSize) => {
        console.log(windowSize);
        return {
          id: windowSize.toString(),
          header: t('columns.tokens', { tokens: windowSize }),
          // @ts-expect-error - not typed
          cell: ({ row }) => {
            const costMap = row.original.costMap;
            let creditAmount = costMap[windowSize];

            if (!creditAmount) {
              // find the next available window size
              const nextAvailableWindowSize = Object.keys(
                row.original.costMap,
              ).find((key) => parseInt(key, 10) > parseInt(windowSize, 10));

              if (nextAvailableWindowSize) {
                creditAmount = costMap[nextAvailableWindowSize];
              } else {
                // largest window size
                const largestAvailableWindowSize = Object.keys(
                  row.original.costMap,
                ).sort((a, b) => parseInt(b, 10) - parseInt(a, 10))[0];

                creditAmount = costMap[largestAvailableWindowSize];
              }
            }

            return t('credits', { credits: creditAmount });
          },
        };
      }),
    ];
  }, [costs, t]);

  const costList = useMemo(() => {
    if (!costs) {
      return [];
    }

    return costs.body.stepCosts;
  }, [costs]);

  return (
    <DashboardPageLayout
      title={t('title')}
      encapsulatedFullHeight
      subtitle={t('description')}
    >
      <DashboardPageSection fullHeight>
        <DataTable
          autofitHeight
          searchValue={search}
          showPagination
          onSearch={setSearch}
          hasNextPage={costs?.body.hasNextPage}
          offset={offset}
          limit={limit}
          onSetOffset={setOffset}
          onLimitChange={setLimit}
          columns={columns}
          data={costList}
          isLoading={!costs}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default CostExplorer;
