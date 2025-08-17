'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Badge,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  type FieldDefinitions,
  HStack,
  isGenericQueryCondition,
  isMultiValue,
  QueryBuilder,
  type QueryBuilderQuery,
  SearchIcon,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import type {
  GetTracesByProjectIdQueryType,
  ParentSpanResponseType,
  webApiContracts,
} from '@letta-cloud/sdk-web';
import { GetTracesByProjectIdQuery } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { ViewMessageTrace } from '@letta-cloud/ui-ade-components';
import { useSearchParams, useParams } from 'next/navigation';
import { useToolsServiceListTools } from '@letta-cloud/sdk-core';
import { useQuery } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

interface UseQueryDefinitionResponse {
  fieldDefinitions: FieldDefinitions;
  initialQuery: QueryBuilderQuery;
}

function useQueryDefinition() {
  const t = useTranslations('projects/(projectSlug)/responses/page');
  const { id: currentProjectId } = useCurrentProject();

  const params = useSearchParams();

  const { data: defaultTools } = useToolsServiceListTools({
    limit: 250,
  });

  // Load template data for default options
  const { data: templateData } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesProjectScopedWithSearch(
      currentProjectId,
      {
        search: '',
        limit: 10,
      },
    ),
    queryData: {
      query: {
        project_id: currentProjectId,
        limit: '10',
      },
    },
  });

  const queryFilter = useMemo(() => {
    const query = params.get('query');

    if (query) {
      try {
        return JSON.parse(query);
      } catch {
        // ignore
      }
    }
  }, [params]);

  const defaultTemplateNameOptions = useMemo(() => {
    if (!templateData?.body) {
      return [];
    }

    const arr = templateData.body.templates.map((template) => ({
      label: template.name,
      value: template.id,
    }));

    // Add "(Any Template Family)" option at the beginning
    arr.unshift({ label: '(Any Template Family)', value: '' });

    return arr;
  }, [templateData?.body]);

  const handleLoadTemplateNames = useCallback(
    async (query: string) => {
      const response = await cloudAPI.templates.listTemplates.query({
        query: {
          search: query,
          project_id: currentProjectId,
          limit: '10',
        },
      });

      if (response.status !== 200) {
        return [];
      }

      const options = response.body.templates.map((template) => ({
        label: template.name,
        value: template.id,
      }));

      // Add "(Any Template Family)" option at the beginning
      options.unshift({ label: '(Any Template Family)', value: '' });

      return options;
    },
    [currentProjectId],
  );

  return useMemo(() => {
    const fieldDefinitions = {
      functionName: {
        id: 'functionName',
        name: t('useQueryDefinition.functionName.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.functionName.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 100,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.functionName.operator.operators.eq',
                  ),
                  value: 'eq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.functionName.value.label'),
            display: 'select',
            options: {
              isMulti: false,
              placeholder: t(
                'useQueryDefinition.functionName.value.placeholder',
              ),
              options: (defaultTools || [])
                .filter((tool) => !!tool.name)
                .map((tool) => ({
                  label: tool.name || '',
                  value: tool.name || '',
                })),
              isLoading: !defaultTools,
            },
          },
        ],
      },
      statusCode: {
        id: 'statusCode',
        name: t('useQueryDefinition.statusCode.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.statusCode.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 200,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.statusCode.operator.operators.eq',
                  ),
                  value: 'eq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.statusCode.value.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 300,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.statusCode.value.options.tool_error',
                  ),
                  value: 'tool_error',
                },
                {
                  label: t(
                    'useQueryDefinition.statusCode.value.options.api_error',
                  ),
                  value: 'api_error',
                },
              ],
            },
          },
        ],
      },
      // duration: {
      //   id: 'duration',
      //   name: t('useQueryDefinition.duration.name'),
      //   queries: [
      //     {
      //       key: 'operator',
      //       label: t('useQueryDefinition.duration.operator.label'),
      //       display: 'select',
      //       options: {
      //         styleConfig: {
      //           containerWidth: 200,
      //         },
      //         options: [
      //           {
      //             label: t(
      //               'useQueryDefinition.duration.operator.operators.gte',
      //             ),
      //             value: 'gte',
      //           },
      //           {
      //             label: t(
      //               'useQueryDefinition.duration.operator.operators.lte',
      //             ),
      //             value: 'lte',
      //           },
      //         ],
      //       },
      //     },
      //     {
      //       key: 'value',
      //       label: t('useQueryDefinition.duration.value.label'),
      //       display: 'input',
      //       options: {
      //         placeholder: t('useQueryDefinition.duration.value.placeholder'),
      //       },
      //     },
      //     {
      //       key: 'unit',
      //       label: t('useQueryDefinition.duration.unit.label'),
      //       display: 'select',
      //       options: {
      //         styleConfig: {
      //           containerWidth: 150,
      //         },
      //         options: [
      //           {
      //             label: t('useQueryDefinition.duration.unit.options.s'),
      //             value: 's',
      //           },
      //           {
      //             label: t('useQueryDefinition.duration.unit.options.ms'),
      //             value: 'ms',
      //           },
      //           {
      //             label: t('useQueryDefinition.duration.unit.options.m'),
      //             value: 'm',
      //           },
      //         ],
      //       },
      //     },
      //   ],
      // },
      templateFamily: {
        id: 'templateFamily',
        name: 'Template Family',
        queries: [
          {
            key: 'operator',
            label: 'Operator',
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 100,
              },
              options: [
                {
                  label: 'equals',
                  value: 'eq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: 'Template',
            display: 'async-select',
            options: {
              placeholder: 'Select template family...',
              defaultOptions: defaultTemplateNameOptions || [],
              loadOptions: handleLoadTemplateNames,
            },
          },
        ],
      },
      agentSteps: {
        id: 'agentSteps',
        name: t('useQueryDefinition.agentSteps.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.agentSteps.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 200,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.agentSteps.operator.operators.eq',
                  ),
                  value: 'eq',
                },
                {
                  label: t(
                    'useQueryDefinition.agentSteps.operator.operators.gte',
                  ),
                  value: 'gte',
                },
                {
                  label: t(
                    'useQueryDefinition.agentSteps.operator.operators.lte',
                  ),
                  value: 'lte',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.agentSteps.value.label'),
            display: 'input',
            options: {
              placeholder: t('useQueryDefinition.agentSteps.value.placeholder'),
            },
          },
        ],
      },
    } as const satisfies FieldDefinitions;

    const initialQuery =
      queryFilter ||
      ({
        root: {
          combinator: 'AND',
          items: [
            {
              field: fieldDefinitions.functionName.id,
              queryData: {
                operator:
                  fieldDefinitions.functionName.queries[0].options.options[0],
                value: {
                  label: '',
                  value: '',
                },
              },
            },
          ],
        },
      } satisfies QueryBuilderQuery);

    return {
      fieldDefinitions,
      initialQuery,
    } satisfies UseQueryDefinitionResponse;
  }, [
    defaultTools,
    queryFilter,
    t,
    handleLoadTemplateNames,
    defaultTemplateNameOptions,
  ]);
}

export default function ResponsesPage() {
  const { projectSlug } = useParams();
  const { id: projectId } = useCurrentProject();
  const [limit, setLimit] = useState(0);
  const [offset, setOffset] = useState(0);

  const { fieldDefinitions, initialQuery } = useQueryDefinition();

  const [draftQuery, setDraftQuery] = useState<QueryBuilderQuery>(initialQuery);
  const [query, setQuery] = useState<QueryBuilderQuery>(initialQuery);

  useEffect(() => {
    // set search params as JSON string of draftQuery

    const searchParams = new URLSearchParams();

    searchParams.set('query', JSON.stringify(query));

    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${searchParams}`,
    );
  }, [query]);

  const compiledQuery: GetTracesByProjectIdQueryType = useMemo(() => {
    const searchItems = query.root.items
      .map((item) => {
        if (isGenericQueryCondition(item) || !item.queryData) {
          return null;
        }

        const baseItem: any = {
          field: item.field,
        };

        // Process each query data entry
        Object.entries(item.queryData).forEach(([key, value]) => {
          if (!value) {
            return;
          }

          if (isMultiValue(value)) {
            baseItem[key] = value.map((val) => val.value);
          } else {
            baseItem[key] = value?.value || value;
          }
        });

        // Special handling for duration field - ensure unit exists with fallback
        if (item.field === 'duration') {
          if (!baseItem.unit) {
            baseItem.unit = 'ms'; // Default to milliseconds
          }
        }

        // Validate required fields exist
        if (!baseItem.operator || (!baseItem.value && baseItem.value !== '')) {
          return null;
        }

        return baseItem;
      })
      .filter(Boolean); // Remove null items

    const val = {
      search: searchItems,
      limit,
      offset,
      projectId,
    };

    const res = GetTracesByProjectIdQuery.safeParse(val);

    if (res.success) {
      return res.data satisfies GetTracesByProjectIdQueryType;
    }

    return {
      limit,
      offset,
      projectId,
    };
  }, [query, limit, offset, projectId]);

  const { data, isError } = useQuery<
    ServerInferResponses<
      typeof webApiContracts.observability.getTracesByProjectId
    >
  >({
    queryKey: webApiQueryKeys.observability.getTracesByProjectId(compiledQuery),
    queryFn: () =>
      webApi.observability.getTracesByProjectId.mutate({
        body: compiledQuery,
      }),
    enabled: !!limit,
  });

  const { formatDateAndTime, formatSmallDuration } = useFormatters();

  const t = useTranslations('projects/(projectSlug)/responses/page');

  const columns: Array<ColumnDef<ParentSpanResponseType>> = useMemo(
    () => [
      {
        id: 'timestamp',
        accessorKey: 'createdAt',
        header: t('columns.timestamp'),
        cell: ({ row }) => {
          return formatDateAndTime(row.original?.createdAt || '');
        },
      },
      {
        id: 'status',
        accessorKey: 'executionStatus',
        header: t('columns.status'),
        cell: ({ row }) => {
          if (row.original.requestStatus === 'error') {
            return (
              <Tooltip content={t('statuses.requestFailed.tooltip')}>
                <Badge
                  content={t('statuses.requestFailed.label')}
                  variant="destructive"
                />
              </Tooltip>
            );
          }

          if (row.original.executionStatus === 'error') {
            return (
              <Tooltip content={t('statuses.executionFailed.tooltip')}>
                <Badge
                  content={t('statuses.executionFailed.label')}
                  variant="destructive"
                />
              </Tooltip>
            );
          }

          return (
            <Badge content={t('statuses.success.label')} variant="success" />
          );
        },
      },
      {
        id: 'agent',
        accessorKey: 'agentId',
        header: t('columns.agent'),
      },

      {
        id: 'duration',
        accessorKey: 'duration',
        header: t('columns.duration'),
        cell: ({ row }) => {
          return formatSmallDuration(row.original?.durationNs || 0);
        },
      },
      {
        id: 'actions',
        header: t('columns.actions'),
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => {
          return (
            <HStack align="center" justify="end">
              <Button
                href={`/projects/${projectSlug}/agents/${row.original.agentId}`}
                label={t('actions.viewAgent')}
                color="tertiary"
                size="small"
              />
              <ViewMessageTrace
                trigger={
                  <Button
                    label={t('actions.exploreMessage')}
                    color="secondary"
                    size="small"
                  />
                }
                traceId={row.original.traceId}
                agentId={row.original.agentId}
              />
            </HStack>
          );
        },
      },
    ],
    [formatDateAndTime, formatSmallDuration, t, projectSlug],
  );

  const items = useMemo(() => {
    if (data?.status !== 200 || !data.body.items) {
      return [];
    }

    return data?.body.items;
  }, [data]);

  const hasNextPage = useMemo(() => {
    if (data?.status !== 200 || !data.body.hasNextPage) {
      return false;
    }

    return data.body.hasNextPage;
  }, [data]);

  return (
    <DashboardPageLayout title={t('title')} encapsulatedFullHeight>
      <DashboardPageSection fullHeight>
        <VStack fullHeight fullWidth>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(draftQuery);
            }}
          >
            <VStack gap={false}>
              <VStack>
                <Typography bold>{t('search.label')}</Typography>
                <QueryBuilder
                  query={draftQuery}
                  onSetQuery={(query) => {
                    setDraftQuery(query);
                  }}
                  definition={fieldDefinitions}
                />
              </VStack>
              <HStack
                /* eslint-disable-next-line react/forbid-component-props */
                className="mt-[-26px] pointer-events-none"
                paddingTop="small"
                fullWidth
                align="center"
                justify="end"
              >
                <HStack
                  /* eslint-disable-next-line react/forbid-component-props */
                  className="pointer-events-auto"
                  align="center"
                  justify="end"
                >
                  <Button
                    type="submit"
                    preIcon={<SearchIcon />}
                    label={t('search.button')}
                    color="secondary"
                  />
                </HStack>
              </HStack>
            </VStack>
          </form>
          <VStack fullHeight position="relative" fullWidth>
            <DataTable
              isLoading={!data}
              limit={limit}
              offset={offset}
              hasNextPage={hasNextPage}
              onSetOffset={setOffset}
              showPagination
              autofitHeight
              errorMessage={isError ? t('errorMessage') : undefined}
              loadingText={t('loadingMessage')}
              onLimitChange={setLimit}
              columns={columns}
              data={items}
            />
          </VStack>
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
