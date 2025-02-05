'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InfoTooltip } from '@letta-cloud/component-library';
import type {
  FieldDefinitions,
  QueryBuilderQuery,
} from '@letta-cloud/component-library';
import {
  Badge,
  Card,
  CopyButton,
  isGenericQueryCondition,
  isMultiValue,
  MiddleTruncate,
  QueryBuilder,
  SearchIcon,
} from '@letta-cloud/component-library';
import { Frame } from '@letta-cloud/component-library';
import {
  Button,
  CloseIcon,
  LettaLoader,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import {
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  RawInput,
} from '@letta-cloud/component-library';
import {
  webApi,
  webApiQueryKeys,
  webOriginSDKApi,
  webOriginSDKQueryKeys,
} from '$web/client';
import { useCurrentProject } from '../hooks';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  AgentState,
  ExtendedAgentState,
} from '@letta-cloud/letta-agents-api';

import {
  TagService,
  useTagServiceListTags,
} from '@letta-cloud/letta-agents-api';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/letta-agents-api';
import { useTranslations } from '@letta-cloud/translations';
import { DeployAgentDialog } from './DeployAgentDialog/DeployAgentDialog';
import { useDateFormatter } from '@letta-cloud/helpful-client-utils';
import { SearchDeployedAgentsSchema } from '@letta-cloud/letta-agents-api';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { sdkContracts } from '@letta-cloud/letta-agents-api';
import type { ServerInferResponses } from '@ts-rest/core';
import { Messages } from '@letta-cloud/shared-ade-components';
import type { InfiniteData } from '@tanstack/query-core';

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
      <VStack fullHeight overflow="hidden">
        <Messages mode="simple" isSendingMessage={false} agentId={agentId} />
      </VStack>
    </VStack>
  );
}

interface DeployedAgentViewProps {
  agent: AgentState;
  onClose: () => void;
}

function DeployedAgentView(props: DeployedAgentViewProps) {
  const { agent, onClose } = props;
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
        /* eslint-disable-next-line react/forbid-component-props */
        className="absolute z-[1] fade-in-5 opacity-10"
      />
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
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
          <Typography align="left" bold variant="heading4">
            {name}
          </Typography>
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
                  {/*<HStack fullWidth justify="end">*/}
                  {/*  <Button label="Connection instructions" preIcon={<BotIcon />} color="secondary" />*/}
                  {/*</HStack>*/}
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

  const { id: currentProjectId } = useCurrentProject();

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
          value: `${agent.testingAgentName}:${agent.version}`,
        })),
        { label: t('anyVersion'), value: '' },
      ];
    },
    [currentProjectId, t],
  );

  const defaultTemplateSearchOptions = useMemo(() => {
    if (!data?.body) {
      return null;
    }

    const arr = data.body.deployedAgentTemplates.map((agent) => {
      const version = `${agent.testingAgentName}:${agent.version}`;

      return { label: version, value: version };
    });

    arr.unshift({ label: t('anyVersion'), value: '' });

    return arr;
  }, [data?.body, t]);

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
      version: {
        id: 'version',
        name: t('useQueryDefinition.agentTemplate.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.agentTemplate.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.agentTemplate.operator.operators.equals',
                  ),
                  value: 'eq',
                },
                {
                  label: t(
                    'useQueryDefinition.agentTemplate.operator.operators.notEquals',
                  ),
                  value: 'neq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.agentTemplate.value.label'),
            display: 'async-select',
            options: {
              placeholder: t(
                'useQueryDefinition.agentTemplate.value.placeholder',
              ),
              defaultOptions: defaultTemplateSearchOptions || [],
              loadOptions: handleLoadOptions,
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
              field: fieldDefinitions.name.id,
              queryData: {
                operator: fieldDefinitions.name.queries[0].options.options[0],
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
    defaultTemplateSearchOptions,
    queryFilter,
    handleLoadOptions,
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

function DeployedAgentsPage() {
  const { fieldDefinitions, initialQuery } = useQueryDefinition();

  const [draftQuery, setDraftQuery] = useState<QueryBuilderQuery>(initialQuery);
  const [query, setQuery] = useState<QueryBuilderQuery>(initialQuery);
  const t = useTranslations('projects/(projectSlug)/agents/page');

  useEffect(() => {
    // set search params as JSON string of draftQuery

    const searchParams = new URLSearchParams();

    searchParams.set('query', JSON.stringify(draftQuery));

    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${searchParams}`,
    );
  }, [draftQuery]);

  const [limit, setLimit] = useState(0);
  const [page, setPage] = useState<number>(0);

  const [selectedAgent, setSelectedAgent] = useState<AgentState>();

  const { id: currentProjectId } = useCurrentProject();

  const compiledQuery = useMemo(() => {
    const val = {
      search: query.root.items.map((item) => {
        if (isGenericQueryCondition(item) || !item.queryData) {
          return null;
        }

        return {
          field: item.field,
          ...Object.entries(item.queryData).reduce((acc, [key, value]) => {
            if (!value) {
              return acc;
            }

            if (isMultiValue(value)) {
              return {
                ...acc,
                [key]: value.map((val) => val.value),
              };
            }

            return {
              ...acc,
              [key]: value?.value || '',
            };
          }, {}),
        };
      }),
      limit,
      project_id: currentProjectId,
      combinator: query.root.combinator,
    };

    if (SearchDeployedAgentsSchema.safeParse(val).success) {
      return val;
    }

    return {};
  }, [currentProjectId, query, limit]);

  const { data, isFetchingNextPage, fetchNextPage } = useInfiniteQuery<
    ServerInferResponses<typeof sdkContracts.agents.searchDeployedAgents, 200>,
    unknown,
    InfiniteData<
      ServerInferResponses<typeof sdkContracts.agents.searchDeployedAgents, 200>
    >,
    unknown[],
    { after?: string | null }
  >({
    queryKey: [
      'infinite',
      ...webOriginSDKQueryKeys.agents.searchDeployedAgents(compiledQuery),
    ],
    queryFn: async ({ pageParam }) => {
      const response = await webOriginSDKApi.agents.searchDeployedAgents.mutate(
        {
          body: {
            ...compiledQuery,
            after: pageParam?.after,
          },
        },
      );

      if (response.status !== 200) {
        throw new Error('Failed to fetch agents');
      }

      return response;
    },
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
                  label: version,
                  value: version,
                },
              },
            },
          ],
        },
      } satisfies QueryBuilderQuery;

      setQuery(nextQuery);
      setDraftQuery(nextQuery);
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
  const { formatDateAndTime } = useDateFormatter();

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
                    filterByVersion(row.original.template || '');
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
        id: 'createdAt',
        header: t('table.columns.lastUpdatedAt'),
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
    [currentProjectSlug, filterByVersion, formatDateAndTime, t],
  );

  return (
    <DashboardPageLayout
      actions={<DeployAgentDialog />}
      encapsulatedFullHeight
      title="Agents"
    >
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
          <HStack fullHeight position="relative" fullWidth>
            <DataTable
              fullHeight
              autofitHeight
              minHeight={400}
              limit={limit}
              onLimitChange={setLimit}
              bottomLeftContent={
                agents &&
                agents.length > 0 && (
                  <>
                    <HStack align="center">
                      <Typography variant="body2" color="muted">
                        {t('table.wipResults')}
                      </Typography>
                      <InfoTooltip text={t('table.wipResultsInfo')} />
                    </HStack>
                  </>
                )
              }
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
              />
            )}
          </HStack>
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DeployedAgentsPage;
