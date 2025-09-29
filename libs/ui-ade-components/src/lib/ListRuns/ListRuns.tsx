'use client';
import { useTranslations } from '@letta-cloud/translations';
import type { ColumnDef } from '@tanstack/react-table';
import {
  RunsService,
  type Run,
  type ListRunsResponse,
  type StopReasonType,
  type ListRunsData,
} from '@letta-cloud/sdk-core';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  compileSearchTerms,
  DataTable,
  type FieldDefinitions,
  HStack,
  QueryBuilder,
  type QueryBuilderQuery,
  QueryBuilderWrapper,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useFormatters } from '@letta-cloud/utils-client';
import { get } from 'lodash-es';
import { useADEAppContext } from '../AppContext/AppContext';

const UseInfiniteRunsQueryFn = (params: Partial<ListRunsData>) => [
  'listRuns',
  params,
];
//
// interface CancelRunButtonProps {
//   run: Run;
//   isRunning: boolean;
// }
//
// function CancelRunButton(props: CancelRunButtonProps) {
//   const { run, isRunning } = props;
//   const t = useTranslations('ListRuns');
//
//   const { mutate: cancelRun, isPending } = useAgentsServiceCancelAgentRun();
//
//   const handleCancel = () => {
//     if (!run.agent_id) return;
//
//     cancelRun({
//       agentId: run.agent_id,
//       requestBody: {
//         run_ids: [run.id || ''],
//       },
//     });
//   };
//
//   if (!isRunning || !run.agent_id) {
//     return null;
//   }
//
//   return (
//     <Button
//       size="small"
//       color="tertiary"
//       preIcon={<CancelIcon />}
//       onClick={handleCancel}
//       disabled={isPending}
//       label={isPending ? t('cancelRun.cancelling') : t('cancelRun.cancel')}
//     />
//   );
// }

interface StatusCellProps {
  status?: string;
}

function StatusCell(props: StatusCellProps) {
  const { status } = props;

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'error':
        return 'destructive';
      case 'running':
      case 'in_progress':
        return 'info';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Badge
      size="small"
      content={status || 'unknown'}
      variant={getStatusVariant(status)}
    />
  );
}

interface DurationCellProps {
  durationNs?: number | null;
}

function DurationCell(props: DurationCellProps) {
  const { durationNs } = props;
  const { formatSmallDuration } = useFormatters();

  if (!durationNs) return <Typography variant="body3">-</Typography>;

  return (
    <Typography variant="body3">{formatSmallDuration(durationNs)}</Typography>
  );
}

interface StopReasonCellProps {
  stopReason?: string;
}

function StopReasonCell(props: StopReasonCellProps) {
  const { stopReason } = props;

  const getStopReasonVariant = (stopReason?: string) => {
    switch (stopReason) {
      case 'error':
      case 'llm_api_error':
      case 'invalid_llm_response':
      case 'invalid_tool_call':
      case 'max_steps':
      case 'no_tool_call':
        return 'destructive';
      case 'requires_approval':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Badge
      size="small"
      content={stopReason || 'unknown'}
      variant={getStopReasonVariant(stopReason)}
    />
  );
}

interface DateCellProps {
  date?: string | null;
}

function DateCell(props: DateCellProps) {
  const { date } = props;
  const { formatDateAndTime } = useFormatters();

  if (!date) return <Typography variant="body3">-</Typography>;

  return <Typography variant="body3">{formatDateAndTime(date)}</Typography>;
}

interface ViewAgentButtonProps {
  run: Run;
}

function ViewAgentButton(props: ViewAgentButtonProps) {
  const { projectSlug } = useADEAppContext();
  const { run } = props;
  const t = useTranslations('ListRuns');

  const agentId = get(run.metadata, 'agent_id', '');

  if (!agentId) {
    return null;
  }

  return (
    <Button
      size="small"
      color="secondary"
      label={t('viewAgent')}
      href={`/projects/${projectSlug}/agents/${agentId}`}
    />
  );
}

interface UseQueryDefinitionResponse {
  fieldDefinitions: FieldDefinitions;
  initialQuery: QueryBuilderQuery;
}


function useQueryDefinition() {
  const t = useTranslations('ListRuns');

  return useMemo(() => {
    const fieldDefinitions = {
      stopReason: {
        id: 'stopReason',
        single: true,
        name: t('useQueryDefinition.stopReason.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.stopReason.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.stopReason.operator.operators.equals',
                  ),
                  value: 'eq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.stopReason.value.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 200,
              },
              options: [
                {
                  label: t('useQueryDefinition.stopReason.value.options.any'),
                  value: 'any',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.end_turn',
                  ),
                  value: 'end_turn',
                },
                {
                  label: t('useQueryDefinition.stopReason.value.options.error'),
                  value: 'error',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.llm_api_error',
                  ),
                  value: 'llm_api_error',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.invalid_llm_response',
                  ),
                  value: 'invalid_llm_response',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.invalid_tool_call',
                  ),
                  value: 'invalid_tool_call',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.max_steps',
                  ),
                  value: 'max_steps',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.no_tool_call',
                  ),
                  value: 'no_tool_call',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.tool_rule',
                  ),
                  value: 'tool_rule',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.cancelled',
                  ),
                  value: 'cancelled',
                },
                {
                  label: t(
                    'useQueryDefinition.stopReason.value.options.requires_approval',
                  ),
                  value: 'requires_approval',
                },
              ],
            },
          },
        ],
      },
    } as const satisfies FieldDefinitions;

    const initialQuery = {
      root: {
        combinator: 'AND',
        items: [
          {
            field: fieldDefinitions.stopReason.id,
            queryData: {
              operator:
                fieldDefinitions.stopReason.queries[0].options.options[0],
              value: fieldDefinitions.stopReason.queries[1].options.options[0],
            },
          },
        ],
      },
    } satisfies QueryBuilderQuery;

    return {
      fieldDefinitions,
      initialQuery,
    } satisfies UseQueryDefinitionResponse;
  }, [t]);
}

interface CompiledQuery {
  projectId?: string;
  stopReason?: StopReasonType;
  limit?: number;
}

interface ListRunsProps {
  projectId?: string;
}

export function ListRuns(props: ListRunsProps) {
  const { projectId } = props;
  const t = useTranslations('ListRuns');

  const { fieldDefinitions, initialQuery } = useQueryDefinition();

  const [page, setPage] = useState<number>(0);
  const [limit, setLimit] = useState(0);
  const [draftQuery, setDraftQuery] = useState<QueryBuilderQuery>(initialQuery);
  const [query, setQuery] = useState<QueryBuilderQuery>(initialQuery);

  const compiledQuery = useMemo(() => {
    const searchTerms = compileSearchTerms(query.root.items);
    const compiledQuery: CompiledQuery = {};

    searchTerms.forEach((term) => {
      if (term.field === 'stopReason') {
        if (
          term.operator === 'eq' &&
          typeof term.value === 'string' &&
          term.value !== 'any'
        ) {
          compiledQuery.stopReason = term.value as StopReasonType;
        }
      }
    });

    return {
      ...(projectId ? { projectId } : {}),
      limit,
      ...compiledQuery,
    };
  }, [projectId, query, limit]);

  const { data, isFetchingNextPage, isError, fetchNextPage } = useInfiniteQuery<
    ListRunsResponse,
    unknown,
    InfiniteData<ListRunsResponse>,
    unknown[],
    { before?: string | null }
  >({
    queryKey: UseInfiniteRunsQueryFn(compiledQuery),
    queryFn: ({ pageParam }) => {
      return RunsService.listRuns({
        limit: limit + 1,
        before: pageParam?.before,
        ...(compiledQuery.stopReason
          ? { stopReason: compiledQuery.stopReason }
          : {}),
      });
    },
    refetchInterval: 3000,
    initialPageParam: { before: null },
    getNextPageParam: (lastPage) => {
      if (lastPage.length > limit) {
        return {
          before: lastPage[lastPage.length - 2].id,
        };
      }
      return undefined;
    },
    enabled: !!limit,
  });

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const hasNextPage = useMemo(() => {
    if (!data?.pages?.[page]) {
      return false;
    }

    return data.pages[page].length > limit;
  }, [data, page, limit]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  // Add query builder key for re-rendering
  const queryBuilderKey = useMemo(() => {
    return JSON.stringify(Object.keys(fieldDefinitions));
  }, [fieldDefinitions]);

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.[page]?.slice(0, limit) || [];
  }, [data, page, limit]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  const columns: Array<ColumnDef<Run>> = useMemo(() => {
    return [
      {
        id: 'status',
        header: t('columns.status'),
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <HStack align="center">
            <StatusCell status={row.original.status} />
          </HStack>
        ),
      },
      {
        id: 'runId',
        header: t('columns.runId'),
        accessorFn: (row) => row.id,
        cell: ({ row }) => (
          <Typography variant="body3" className="font-mono">
            {row.original.id?.slice(0, 8) || '-'}
          </Typography>
        ),
      },
      // {
      //   id: 'agentId',
      //   header: t('columns.agentId'),
      //   accessorFn: (row) => row.agent_id,
      //   cell: ({ row }) => (
      //     <Typography variant="body3" className="font-mono">
      //       {row.original.agent_id?.slice(0, 8) || '-'}
      //     </Typography>
      //   ),
      // },
      {
        id: 'duration',
        header: t('columns.duration'),
        accessorFn: (row) => row.total_duration_ns,
        cell: ({ row }) => (
          <DurationCell durationNs={row.original.total_duration_ns} />
        ),
      },
      {
        id: 'stopReason',
        header: t('columns.stopReason'),
        accessorFn: (row) => row.stop_reason,
        cell: ({ row }) => (
          <HStack align="center">
            {row.original.stop_reason && <StopReasonCell stopReason={row.original.stop_reason} />}
          </HStack>
        ),
      },
      {
        id: 'completedAt',
        header: t('columns.completedAt'),
        accessorFn: (row) => row.completed_at,
        cell: ({ row }) => <DateCell date={row.original.completed_at} />,
      },
      {
        id: 'createdAt',
        header: t('columns.createdAt'),
        accessorFn: (row) => row.created_at,
        cell: ({ row }) => <DateCell date={row.original.created_at} />,
      },
      {
        id: 'actions',
        header: t('columns.actions'),
        cell: ({ row }) => (
          <HStack align="center">
            <ViewAgentButton run={row.original} />
          </HStack>
        ),
      },
    ];
  }, [t]);

  return (
    <VStack fullHeight overflow="hidden">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draftQuery);
        }}
      >
        <QueryBuilderWrapper label={t('query')}>
          <QueryBuilder
            key={queryBuilderKey}
            query={draftQuery}
            onSetQuery={(query) => {
              setDraftQuery(query);
            }}
            definition={fieldDefinitions}
          />
        </QueryBuilderWrapper>
      </form>
      <VStack flex overflow="hidden">
        <DataTable
          autofitHeight
          onSetPage={setPage}
          page={page}
          errorMessage={isError ? t('table.error') : undefined}
          onLimitChange={setLimit}
          limit={limit}
          hasNextPage={hasNextPage}
          showPagination
          columns={columns}
          data={filteredData}
          isLoading={isLoadingPage}
          loadingText={t('table.loading')}
          noResultsText={t('table.noResults')}
        />
      </VStack>
    </VStack>
  );
}
