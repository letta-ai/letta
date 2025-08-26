'use client';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  compileSearchTerms,
  DotsVerticalIcon,
  QueryBuilderWrapper,
  SortableHeader,
} from '@letta-cloud/ui-component-library';
import type {
  FieldDefinitions,
  QueryBuilderQuery,
} from '@letta-cloud/ui-component-library';
import {
  Badge,
  Card,
  CopyButton,
  isGenericQueryCondition,
  MiddleTruncate,
  QueryBuilder,
  DropdownMenu,
  DropdownMenuItem,
} from '@letta-cloud/ui-component-library';
import { Frame } from '@letta-cloud/ui-component-library';
import {
  Button,
  CloseIcon,
  LettaLoader,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  DataTable,
  HStack,
  RawInput,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '$web/client';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import type { AgentState } from '@letta-cloud/sdk-core';
import { TagService, useTagServiceListTags } from '@letta-cloud/sdk-core';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import {
  Messages,
  DeleteAgentDialog,
} from '@letta-cloud/ui-ade-components';
import type { InfiniteData } from '@tanstack/query-core';
import {
  type ExtendedAgentState,
  type cloudContracts,
  SearchDeployedAgentsSchema,
  cloudAPI,
  cloudQueryKeys,
} from '@letta-cloud/sdk-cloud-api';
import { TrashIcon } from '@letta-cloud/ui-component-library';
import { useQueryIdentities } from '@letta-cloud/ui-ade-components';

const TEMPLATE_SEARCH_LIMIT = 10;

interface AgentMessagesListProps {
  agentId: string;
}

function AgentMessagesList(props: AgentMessagesListProps) {
  const { agentId } = props;
  const t = useTranslations('projects/(projectSlug)/agents/page');

  return (
    <VStack border collapseHeight>
      <HStack borderBottom paddingX="small" paddingY="small">
        <Typography>{t('latestMessages')}</Typography>
      </HStack>
      <VStack fullHeight position="relative" overflow="hidden">
        <Messages
          mode="interactive"
          disableInteractivity
          isSendingMessage={false}
          agentId={agentId}
        />
      </VStack>
    </VStack>
  );
}

interface DeployedAgentViewProps {
  agent: AgentState;
  onClose: () => void;
  onAgentUpdate: () => void;
}

function DeployedAgentView(props: DeployedAgentViewProps) {
  const { agent, onClose, onAgentUpdate } = props;
  const { name } = agent;
  const { slug: currentProjectSlug } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const { data } = useAgentsServiceRetrieveAgent({
    agentId: agent.id || '',
  });

  return (
    <div className="contents">
      <Frame
        onClick={onClose}
        color="background-black"
        fullHeight
        fullWidth
        /*eslint-disable-next-line react/forbid-component-props */
        className="absolute z-[1] fade-in-5 opacity-10"
      />
      <VStack
        /*eslint-disable-next-line react/forbid-component-props */
        className="absolute z-10 sm:animate-in slide-in-from-right-10 sm:w-[70%] right-0"
        color="background"
        border
        fullHeight
        fullWidth
      >
        <HStack
          padding
          paddingY="small"
          borderBottom
          align="center"
          fullWidth
          justify="spaceBetween"
        >
          <HStack align="center" gap="small">
            <Typography align="left" bold variant="heading4">
              {name}
            </Typography>
            <DropdownMenu
              trigger={
                <Button
                  data-testid={`agent-actions-button:${agent.id}`}
                  color="tertiary"
                  label={t('actions')}
                  preIcon={<DotsVerticalIcon />}
                  size="default"
                  hideLabel
                />
              }
              triggerAsChild
            >
              <DeleteAgentDialog
                agentId={agent.id || ''}
                agentName={agent.name || ''}
                trigger={
                  <DropdownMenuItem
                    doNotCloseOnSelect
                    preIcon={<TrashIcon />}
                    label="Delete Agent"
                  />
                }
                onSuccess={() => {
                  onClose();
                  onAgentUpdate();
                }}
              />
            </DropdownMenu>
          </HStack>

          <HStack>
            <Button
              href={`/projects/${currentProjectSlug}/agents/${agent.id}`}
              label={t('openInADE')}
              color="secondary"
            />

            <Button
              onClick={onClose}
              color="tertiary"
              label={t('close')}
              hideLabel
              preIcon={<CloseIcon />}
            />
          </HStack>
        </HStack>
        <VStack padding paddingY="small" overflowY="hidden" fullHeight>
          {!data ? (
            <VStack align="center" justify="center" fullHeight fullWidth>
              <LettaLoader size="large" />
            </VStack>
          ) : (
            <VStack fullHeight overflow="hidden" gap>
              <Card>
                <VStack>
                  <RawInput
                    inline
                    label={t('agentId')}
                    defaultValue={agent.id}
                    readOnly
                    allowCopy
                    fullWidth
                  />
                </VStack>
              </Card>
              <AgentMessagesList agentId={agent.id || ''} />
            </VStack>
          )}
        </VStack>
      </VStack>
    </div>
  );
}

interface UseQueryDefinitionResponse {
  fieldDefinitions: FieldDefinitions;
  initialQuery: QueryBuilderQuery;
}

function useQueryDefinition() {
  const t = useTranslations('projects/(projectSlug)/agents/page');
  const { id: currentProjectId, slug } = useCurrentProject();

  const params = useSearchParams();

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

  const { data: defaultTags } = useTagServiceListTags();

  const handleLoadTags = useCallback(async (query: string) => {
    try {
      const response = await TagService.listTags({
        queryText: query,
      });

      return response.map((tag) => ({
        label: tag,
        value: tag,
      }));
    } catch {
      return [];
    }
  }, []);

  const { data } = webApi.projects.getProjectDeployedAgentTemplates.useQuery({
    queryKey:
      webApiQueryKeys.projects.getProjectDeployedAgentTemplatesWithSearch(
        currentProjectId,
        {
          includeAgentTemplateInfo: true,
        },
      ),
    queryData: {
      params: { projectId: currentProjectId },
      query: {
        includeAgentTemplateInfo: true,
      },
    },
  });

  const { data: templateData } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesProjectScopedWithSearch(
      currentProjectId,
      {
        search: '',
        limit: TEMPLATE_SEARCH_LIMIT,
      },
    ),
    queryData: {
      query: {
        project_id: currentProjectId,
        limit: TEMPLATE_SEARCH_LIMIT.toString(),
        offset: '0',
      },
    },
  });

  const { defaultIdentities, handleLoadIdentities } = useQueryIdentities({
    projectId: currentProjectId,
    valueType: 'id',
  });

  const handleLoadOptions = useCallback(
    async (query: string) => {
      const response =
        await webApi.projects.getProjectDeployedAgentTemplates.query({
          query: { search: query, includeAgentTemplateInfo: true },
          params: { projectId: currentProjectId },
        });

      if (response.status !== 200) {
        return [];
      }

      return [
        ...response.body.deployedAgentTemplates.map((agent) => ({
          label: `${agent.testingAgentName}:${agent.version}`,
          value: `${slug}/${agent.testingAgentName}:${agent.version}`,
        })),
        { label: t('anyVersion'), value: '' },
      ];
    },
    [currentProjectId, t, slug],
  );

  const defaultTemplateSearchOptions = useMemo(() => {
    if (!data?.body) {
      return null;
    }

    const arr = data.body.deployedAgentTemplates.map((agent) => {
      const version = `${agent.testingAgentName}:${agent.version}`;

      return { label: version, value: `${slug}/${version}` };
    });

    arr.unshift({ label: t('anyVersion'), value: '' });

    return arr;
  }, [data?.body, slug, t]);

  const defaultTemplateNameOptions = useMemo(() => {
    if (!templateData?.body) {
      return null;
    }

    const arr = templateData.body.templates.map((template) => ({
      label: template.name,
      value: `${slug}/${template.name}`,
    }));

    // Add "(Any Family)" option at the beginning
    arr.unshift({ label: t('anyFamily'), value: '' });

    return arr;
  }, [templateData?.body, t, slug]);

  const handleLoadTemplateNames = useCallback(
    async (query: string) => {
      const response = await cloudAPI.templates.listTemplates.query({
        query: {
          search: query,
          project_id: currentProjectId,
          limit: TEMPLATE_SEARCH_LIMIT.toString(),
          offset: '0',
        },
      });

      if (response.status !== 200) {
        return [];
      }

      const options = response.body.templates.map((template) => ({
        label: template.name,
        value: `${slug}/${template.name}`,
      }));

      // Add "(Any Family)" option at the beginning
      options.unshift({ label: t('anyFamily'), value: '' });

      return options;
    },
    [currentProjectId, t, slug]
  );

  return useMemo(() => {
    const fieldDefinitions = {
      name: {
        id: 'name',
        name: t('useQueryDefinition.agentName.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.agentName.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.agentName.operator.operators.contains',
                  ),
                  value: 'contains',
                },
                {
                  label: t(
                    'useQueryDefinition.agentName.operator.operators.equals',
                  ),
                  value: 'eq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.agentName.value.label'),
            display: 'input',
            options: {
              placeholder: t('useQueryDefinition.agentName.value.placeholder'),
            },
          },
        ],
      },
      tags: {
        id: 'tags',
        name: t('useQueryDefinition.agentTags.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.agentTags.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 100,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.agentTags.operator.operators.contains',
                  ),
                  value: 'contains',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.agentTags.value.label'),
            display: 'async-select',
            options: {
              isMulti: true,
              placeholder: t('useQueryDefinition.agentTags.value.placeholder'),
              defaultOptions: (defaultTags || []).map((tag) => ({
                label: tag,
                value: tag,
              })),
              loadOptions: handleLoadTags,
            },
          },
        ],
      },
      identity: {
        id: 'identity',
        name: t('useQueryDefinition.identities.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.identities.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 100,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.identities.operator.operators.equals',
                  ),
                  value: 'eq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.identities.value.label'),
            display: 'async-select',
            options: {
              isMulti: false,
              placeholder: t('useQueryDefinition.identities.value.placeholder'),
              defaultOptions: (defaultIdentities || []).map((identity) => ({
                label: identity.name,
                value: identity.id,
              })),
              loadOptions: handleLoadIdentities,
            },
          },
        ],
      },
      version: {
        id: 'version',
        name: t('useQueryDefinition.templateVersion.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.templateVersion.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.templateVersion.operator.operators.equals',
                  ),
                  value: 'eq',
                },
                {
                  label: t(
                    'useQueryDefinition.templateVersion.operator.operators.notEquals',
                  ),
                  value: 'neq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.templateVersion.value.label'),
            display: 'async-select',
            options: {
              placeholder: t(
                'useQueryDefinition.templateVersion.value.placeholder',
              ),
              defaultOptions: defaultTemplateSearchOptions || [],
              loadOptions: handleLoadOptions,
            },
          },
        ],
      },
      templateName: {
        id: 'templateName',
        name: t('useQueryDefinition.templateFamily.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.templateFamily.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.templateFamily.operator.operators.equals',
                  ),
                  value: 'eq',
                }
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.templateFamily.value.label'),
            display: 'async-select',
            options: {
              placeholder: t(
                'useQueryDefinition.templateFamily.value.placeholder',
              ),
              defaultOptions: defaultTemplateNameOptions || [],
              loadOptions: handleLoadTemplateNames,
            },
          },
        ],
      },
    } as const satisfies FieldDefinitions;

    // Fix the initial query to start with a default condition
    const initialQuery =
      queryFilter ||
      ({
        root: {
          combinator: 'AND',
          items: [
            {
              field: fieldDefinitions.name.id,
              queryData: {
                operator: fieldDefinitions.name.queries[0].options.options[0], // 'contains' operator
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
    defaultIdentities,
    handleLoadIdentities,
    defaultTemplateSearchOptions,
    defaultTemplateNameOptions,
    queryFilter,
    handleLoadOptions,
    handleLoadTemplateNames,
    t,
    defaultTags,
    handleLoadTags,
  ]);
}

interface TagsShorthandProps {
  tags: string[];
  maxTags?: number;
}

function TagsShorthand(props: TagsShorthandProps) {
  const { tags, maxTags = 3 } = props;
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const [showAll, setShowAll] = useState(false);

  const tagsToShow = useMemo(() => {
    if (showAll) {
      return tags;
    }

    return tags.slice(0, maxTags);
  }, [maxTags, showAll, tags]);

  return (
    <HStack>
      {tagsToShow.map((tag) => (
        <Badge key={tag} size="small" content={tag} />
      ))}
      {tags.length > maxTags && !showAll && (
        <button
          onClick={() => {
            setShowAll(true);
          }}
        >
          <Badge
            content={t('TagsShorthand.showAll', {
              count: tags.length - maxTags,
            })}
            size="small"
          />
        </button>
      )}
    </HStack>
  );
}

export function AgentsList() {
  const { fieldDefinitions, initialQuery } = useQueryDefinition();

  const [query, setQuery] = useState<QueryBuilderQuery>(initialQuery);
  const t = useTranslations('projects/(projectSlug)/agents/page');

  // Change the sortBy state type
  const [sortBy, setSortBy] = useState<'created_at' | 'last_run_completion'>(
    'last_run_completion',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Add this line to force QueryBuilder re-render when field definitions change
  const queryBuilderKey = useMemo(() => {
    return JSON.stringify(Object.keys(fieldDefinitions));
  }, [fieldDefinitions]);

  useEffect(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('query', JSON.stringify(query));
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${searchParams}`,
    );
  }, [query]);

  const [limit, setLimit] = useState(0);
  const [page, setPage] = useState<number>(0);
  const [selectedAgent, setSelectedAgent] = useState<AgentState>();
  const { id: currentProjectId } = useCurrentProject();

  const compiledQuery = useMemo(() => {
    const val = {
      search: compileSearchTerms(query.root.items),
      limit,
      project_id: currentProjectId,
      combinator: 'AND' as const,
    };

    const output = SearchDeployedAgentsSchema.safeParse(val);

    if (output.success) {
      return output.data;
    }

    return {
      limit,
      project_id: currentProjectId,
      combinator: 'AND' as const,

    };
  }, [currentProjectId, limit, query]);


  const { data, isFetchingNextPage, fetchNextPage, refetch } = useInfiniteQuery<
    ServerInferResponses<
      typeof cloudContracts.agents.searchDeployedAgents,
      200
    >,
    unknown,
    InfiniteData<
      ServerInferResponses<
        typeof cloudContracts.agents.searchDeployedAgents,
        200
      >
    >,
    unknown[],
    { after?: string | null }
  >({
    queryKey: [
      'infinite',
      ...cloudQueryKeys.agents.searchDeployedAgents(compiledQuery),
      sortBy,
      sortDirection,
    ],
    queryFn: async ({ pageParam }) => {
      const response = await cloudAPI.agents.searchDeployedAgents.mutate({
        body: {
          ...compiledQuery,
          after: pageParam?.after,
          sortBy: sortBy,
          ascending: sortDirection === 'asc',
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to fetch agents');
      }

      return response;
    },
    enabled: !!currentProjectId,
    initialPageParam: { after: null },
    getNextPageParam: (lastPage) => {
      if (lastPage.body.nextCursor) {
        return {
          after: lastPage.body.nextCursor,
        };
      }

      return undefined;
    },
  });

  // Handler for when agents are updated
  const handleAgentUpdate = useCallback(() => {
    setPage(0);
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  useEffect(() => {
    setPage(0);
  }, [compiledQuery]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  const hasNextPage = useMemo(() => {
    return !!data?.pages?.[page]?.body.nextCursor;
  }, [data, page]);

  const filterByVersion = useCallback(
    (version: string) => {
      const [, noProjectVersion] = version.split('/');

      const nextQuery = {
        root: {
          combinator: 'AND',
          items: [
            ...query.root.items.filter((item) => {
              if (isGenericQueryCondition(item)) {
                return true;
              }

              return item.field !== fieldDefinitions.version.id;
            }),
            {
              field: fieldDefinitions.version.id,
              queryData: {
                operator:
                  fieldDefinitions.version.queries[0].options.options[0],
                value: {
                  label: noProjectVersion,
                  value: version,
                },
              },
            },
          ],
        },
      } satisfies QueryBuilderQuery;

      setQuery(nextQuery);
    },
    [
      fieldDefinitions.version.id,
      fieldDefinitions.version.queries,
      query.root.items,
    ],
  );

  const agents = useMemo(() => {
    return data?.pages[page]?.body?.agents || [];
  }, [data, page]);

  const { slug: currentProjectSlug } = useCurrentProject();
  const { formatDateAndTime } = useFormatters();

  // Update the handleSort function parameter type
  const handleSort = useCallback(
    (columnId: 'created_at' | 'last_run_completion') => {
      if (sortBy === columnId) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(columnId);
        setSortDirection('desc');
      }
      setPage(0); // Reset to first page when sorting changes
    },
    [sortBy, sortDirection],
  );

  // Add effect to refetch when sort changes
  useEffect(() => {
    setPage(0);
  }, [sortBy, sortDirection]);

  const DeployedAgentColumns: Array<ColumnDef<ExtendedAgentState>> = useMemo(
    () => [
      {
        id: 'name',
        header: t('table.columns.name'),
        cell: ({ row }) => {
          return (
            <HStack>
              <Typography>{row.original.name}</Typography>
              {row.original.template && (
                <button
                  onClick={() => {
                    filterByVersion(
                      `${currentProjectSlug}/${row.original.template || ''}`,
                    );
                  }}
                >
                  <Badge size="small" content={row.original.template} />
                </button>
              )}
            </HStack>
          );
        },
      },
      {
        id: 'tags',
        header: t('table.columns.tags'),
        cell: ({ row }) => {
          return <TagsShorthand tags={row.original.tags || []} maxTags={3} />;
        },
      },
      {
        id: 'id',
        header: t('table.columns.id'),
        cell: ({ row }) => {
          return (
            <HStack align="center">
              <MiddleTruncate visibleStart={4} visibleEnd={4}>
                {row.original.id}
              </MiddleTruncate>
              <CopyButton
                copyButtonText={t('table.copyId')}
                color="tertiary"
                size="small"
                hideLabel
                textToCopy={row.original.id}
              />
            </HStack>
          );
        },
      },
      {
        id: 'lastRunCompletion',
        header: () => (
          <SortableHeader
            sortKey="last_run_completion"
            currentSortBy={sortBy}
            currentSortDirection={sortDirection}
            onSort={handleSort}
          >
            {t('table.columns.lastRunCompletion')}
          </SortableHeader>
        ),
        cell: ({ row }) => {
          if (
            !row.original?.last_run_completion ||
            Array.isArray(row.original?.last_run_completion)
          ) {
            return '-';
          }

          return formatDateAndTime(row.original.last_run_completion);
        },
      },
      {
        id: 'lastRunDuration',
        header: t('table.columns.lastRunDuration'),
        cell: ({ row }) => {
          if (
            !row.original?.last_run_duration_ms ||
            Array.isArray(row.original?.last_run_duration_ms)
          ) {
            return '-';
          }

          const durationSec = row.original.last_run_duration_ms / 1000;
          if (durationSec < 60) {
            return `${durationSec.toFixed(1)}s`;
          }
          const durationMin = durationSec / 60;
          return `${durationMin.toFixed(1)}m`;
        },
      },
      {
        id: 'createdAt',
        header: () => (
          <SortableHeader
            sortKey="created_at"
            currentSortBy={sortBy}
            currentSortDirection={sortDirection}
            onSort={handleSort}
          >
            {t('table.columns.lastUpdatedAt')}
          </SortableHeader>
        ),
        cell: ({ row }) => {
          if (
            !row.original?.created_at ||
            Array.isArray(row.original?.created_at)
          ) {
            return '';
          }

          return formatDateAndTime(row.original.created_at || '');
        },
      },
      {
        header: '',
        id: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
            sticky: 'right',
          },
        },
        cell: ({ row }) => (
          <HStack>
            <Button
              data-testid="open-in-ade"
              href={`/projects/${currentProjectSlug}/agents/${row.original.id}`}
              color="tertiary"
              label={t('table.openInADE')}
            />
            <Button
              onClick={() => {
                setSelectedAgent(row.original as AgentState);
              }}
              color="secondary"
              label={t('table.preview')}
            />
          </HStack>
        ),
      },
    ],
    [
      currentProjectSlug,
      filterByVersion,
      formatDateAndTime,
      t,
      sortBy,
      sortDirection,
      handleSort,
    ],
  );

  return (
    <VStack fullHeight fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          refetch();
        }}
      >
        <QueryBuilderWrapper label={t('search.label')}>
          <QueryBuilder
            key={queryBuilderKey}
            query={query}
            onSetQuery={setQuery}
            definition={fieldDefinitions}
          />
        </QueryBuilderWrapper>
      </form>
      <HStack fullHeight position="relative" fullWidth>
        <DataTable
          fullHeight
          autofitHeight
          minHeight={400}
          limit={limit}
          onLimitChange={setLimit}
          onSetPage={setPage}
          hasNextPage={hasNextPage}
          showPagination
          page={page}
          loadingText={t('table.loading')}
          noResultsText={t('table.noResults')}
          columns={DeployedAgentColumns}
          data={agents}
          isLoading={isLoadingPage}
        />
        {selectedAgent && (
          <DeployedAgentView
            onClose={() => {
              setSelectedAgent(undefined);
            }}
            agent={selectedAgent}
            onAgentUpdate={handleAgentUpdate}
          />
        )}
      </HStack>
    </VStack>
  );
}
