'use client';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  FieldDefinitions,
  QueryBuilderQuery,
} from '@letta-web/component-library';
import {
  Badge,
  Card,
  CopyButton,
  isGenericQueryCondition,
  isMultiValue,
  MiddleTruncate,
  QueryBuilder,
  SearchIcon,
} from '@letta-web/component-library';
import { Frame } from '@letta-web/component-library';
import {
  Button,
  CloseIcon,
  LettaLoader,
  Typography,
  VStack,
} from '@letta-web/component-library';
import {
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  RawInput,
} from '@letta-web/component-library';
import {
  webApi,
  webApiQueryKeys,
  webOriginSDKApi,
} from '$web/client';
import { useCurrentProject } from '../hooks';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { Messages } from '$web/client/components';
import { useTranslations } from 'next-intl';
import { DeployAgentDialog } from './DeployAgentDialog/DeployAgentDialog';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import { SearchDeployedAgentsSchema } from '$web/sdk/agents/agentsContract';

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

  const { data } = useAgentsServiceGetAgent({
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
              color="tertiary"
            />
            <Button
              onClick={onClose}
              color="tertiary-transparent"
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
                  {/*  <Button label="Connection instructions" preIcon={<BotIcon />} color="tertiary" />*/}
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

  const initialFilter = useMemo(() => {
    const version = params.get('template');
    const value = version;
    const label = version;

    if (value && label) {
      return { value, label };
    }
  }, [params]);

  const { id: currentProjectId } = useCurrentProject();

  const { data } = webApi.projects.getProjectDeployedAgentTemplates.useQuery({
    queryKey:
      webApiQueryKeys.projects.getProjectDeployedAgentTemplatesWithSearch(
        currentProjectId,
        {
          includeAgentTemplateInfo: true,
        }
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
    [currentProjectId, t]
  );

  const defaultTemplateSearchOptions = useMemo(() => {
    if (!data?.body) {
      return null;
    }

    let hasInitialFilter = false;

    const arr = data.body.deployedAgentTemplates.map((agent) => {
      if (initialFilter && agent.id === initialFilter.value) {
        hasInitialFilter = true;
      }

      const version = `${agent.testingAgentName}:${agent.version}`;

      return { label: version, value: version };
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (initialFilter && !hasInitialFilter) {
      arr.unshift(initialFilter);
    }

    arr.unshift({ label: t('anyVersion'), value: '' });

    return arr;
  }, [data?.body, initialFilter, t]);

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
              options: [
                {
                  label: t(
                    'useQueryDefinition.agentName.operator.operators.contains'
                  ),
                  value: 'contains',
                },
                {
                  label: t(
                    'useQueryDefinition.agentName.operator.operators.equals'
                  ),
                  value: 'eq',
                },
                {
                  label: t(
                    'useQueryDefinition.agentName.operator.operators.notEquals'
                  ),
                  value: 'neq',
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
      version: {
        id: 'version',
        name: t('useQueryDefinition.agentTemplate.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.agentTemplate.operator.label'),
            display: 'select',
            options: {
              options: [
                {
                  label: t(
                    'useQueryDefinition.agentTemplate.operator.operators.equals'
                  ),
                  value: 'eq',
                },
                {
                  label: t(
                    'useQueryDefinition.agentTemplate.operator.operators.notEquals'
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
                'useQueryDefinition.agentTemplate.value.placeholder'
              ),
              defaultOptions: defaultTemplateSearchOptions || [],
              loadOptions: handleLoadOptions,
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
    } satisfies QueryBuilderQuery;

    return {
      fieldDefinitions,
      initialQuery,
    } satisfies UseQueryDefinitionResponse;
  }, [defaultTemplateSearchOptions, handleLoadOptions, t]);
}

function DeployedAgentsPage() {
  const { fieldDefinitions, initialQuery } = useQueryDefinition();

  const [query, setQuery] = useState<QueryBuilderQuery>(initialQuery);
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const [limit, setLimit] = useState(0);

  const [selectedAgent, setSelectedAgent] = useState<AgentState>();

  const [offset, setOffset] = useState(0);
  const { id: currentProjectId } = useCurrentProject();

  const compileQuery = useCallback(
    (queryToCompile: QueryBuilderQuery) => {
      const val = {
        search: queryToCompile.root.items.map((item) => {
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
        offset,
        limit,
        project_id: currentProjectId,
        combinator: queryToCompile.root.combinator,
      };

      if (SearchDeployedAgentsSchema.safeParse(val).success) {
        return val;
      }

      return {};
    },
    [currentProjectId, limit, offset]
  );

  const { data, mutate } =
    webOriginSDKApi.agents.searchDeployedAgents.useMutation();

  const searchAgents = useCallback(
    (override?: QueryBuilderQuery) => {
      mutate({
        body: compileQuery(override || query),
      });
    },
    [compileQuery, mutate, query]
  );

  const mounted = useRef(false);

  useEffect(() => {
    if (limit === 0) {
      return;
    }
    if (mounted.current) {
      return;
    }

    mounted.current = true;

    searchAgents();
  }, [currentProjectId, limit, mutate, offset, query, searchAgents]);

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

      searchAgents(nextQuery);
    },
    [
      fieldDefinitions.version.id,
      fieldDefinitions.version.queries,
      query.root.items,
      searchAgents,
    ]
  );

  const agents = data?.body.agents || [];
  const hasNextPage = data?.body.hasNextPage || false;

  const { slug: currentProjectSlug } = useCurrentProject();
  const { formatDateAndTime } = useDateFormatter();

  const DeployedAgentColumns: Array<
    ColumnDef<AgentState & { version?: string }>
  > = useMemo(
    () => [
      {
        id: 'name',
        header: t('table.columns.name'),
        cell: ({ row }) => {
          return (
            <HStack>
              <Typography>{row.original.name}</Typography>
              {row.original.version && (
                <button
                  onClick={() => {
                    filterByVersion(row.original.version || '');
                  }}
                >
                  <Badge size="small" content={row.original.version} />
                </button>
              )}
            </HStack>
          );
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
                color="tertiary-transparent"
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
          return formatDateAndTime(row.original?.created_at || '');
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
              href={`/projects/${currentProjectSlug}/agents/${row.original.id}`}
              color="tertiary-transparent"
              label={t('table.openInADE')}
            />
            <Button
              onClick={() => {
                setSelectedAgent(row.original);
              }}
              color="tertiary"
              label={t('table.preview')}
            />
          </HStack>
        ),
      },
    ],
    [currentProjectSlug, filterByVersion, formatDateAndTime, t]
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
              searchAgents();
            }}
          >
            <VStack border gap={false}>
              <HStack
                justify="spaceBetween"
                color="background-grey"
                padding="small"
                borderBottom
              >
                <Typography>{t('search.label')}</Typography>
              </HStack>
              <VStack paddingX="small" paddingTop="small">
                <QueryBuilder
                  query={query}
                  onSetQuery={(query) => {
                    setQuery(query);
                  }}
                  definition={fieldDefinitions}
                />
              </VStack>
              <HStack justify="end" padding="small" borderTop>
                <Button
                  type="submit"
                  preIcon={<SearchIcon />}
                  label={t('search.button')}
                  color="tertiary"
                />
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
              hasNextPage={hasNextPage}
              showPagination
              offset={offset}
              onSetOffset={setOffset}
              loadingText={t('table.loading')}
              noResultsText={t('table.noResults')}
              columns={DeployedAgentColumns}
              data={agents}
              isLoading={!data}
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
