'use client';
import {
  Button,
  compileSearchTerms,
  type FieldDefinitions,
  HStack,
  QueryBuilder,
  type QueryBuilderQuery,
  QueryBuilderWrapper,
  Skeleton,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryIdentities } from '../hooks/useQueryIdenities/useQueryIdentities';
import type { ListBlocksResponse } from '@letta-cloud/sdk-core';
import {
  BlocksService,
  UseBlocksServiceListBlocksKeyFn,
} from '@letta-cloud/sdk-core';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { MemoryBlock } from './MemoryBlock/MemoryBlock';

interface UseQueryDefinitionResponse {
  fieldDefinitions: FieldDefinitions;
  initialQuery: QueryBuilderQuery;
}

interface UseQueryDefinitionProps {
  projectId: string;
}

function useQueryDefinition(props: UseQueryDefinitionProps) {
  const { projectId } = props;
  const t = useTranslations('ADE/SearchMemoryBlocks');

  const { defaultIdentities, handleLoadIdentities } = useQueryIdentities({
    projectId,
    valueType: 'identifier_key',
  });
  return useMemo(() => {
    const fieldDefinitions = {
      blockValue: {
        id: 'name',
        single: true,
        name: t('useQueryDefinition.blockValue.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.blockValue.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.blockValue.operator.operators.contains',
                  ),
                  value: 'contains',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.blockValue.value.label'),
            display: 'input',
            options: {
              placeholder: t('useQueryDefinition.blockValue.value.placeholder'),
            },
          },
        ],
      },
      name: {
        id: 'name',
        single: true,
        name: t('useQueryDefinition.blockName.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.blockName.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.blockName.operator.operators.contains',
                  ),
                  value: 'contains',
                },
                {
                  label: t(
                    'useQueryDefinition.blockName.operator.operators.equals',
                  ),
                  value: 'eq',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.blockName.value.label'),
            display: 'input',
            options: {
              placeholder: t('useQueryDefinition.blockName.value.placeholder'),
            },
          },
        ],
      },
      blockDescription: {
        id: 'blockDescription',
        single: true,
        name: t('useQueryDefinition.blockDescription.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.blockDescription.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.blockDescription.operator.operators.contains',
                  ),
                  value: 'contains',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.blockDescription.value.label'),
            display: 'input',
            options: {
              placeholder: t(
                'useQueryDefinition.blockDescription.value.placeholder',
              ),
            },
          },
        ],
      },
      attachedAgentsCount: {
        id: 'attachedAgentsCount',
        single: true,
        name: t('useQueryDefinition.attachedAgentsCount.name'),
        queries: [
          {
            key: 'operator',
            label: t('useQueryDefinition.attachedAgentsCount.operator.label'),
            display: 'select',
            options: {
              styleConfig: {
                containerWidth: 150,
              },
              options: [
                {
                  label: t(
                    'useQueryDefinition.attachedAgentsCount.operator.operators.equals',
                  ),
                  value: 'eq',
                },
                {
                  label: t(
                    'useQueryDefinition.attachedAgentsCount.operator.operators.greaterThan',
                  ),
                  value: 'gt',
                },
                {
                  label: t(
                    'useQueryDefinition.attachedAgentsCount.operator.operators.lessThan',
                  ),
                  value: 'lt',
                },
              ],
            },
          },
          {
            key: 'value',
            label: t('useQueryDefinition.attachedAgentsCount.value.label'),
            display: 'input',
            options: {
              placeholder: t(
                'useQueryDefinition.attachedAgentsCount.value.placeholder',
              ),
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
                value: identity.identifier_key,
              })),
              loadOptions: handleLoadIdentities,
            },
          },
        ],
      },
    } as const satisfies FieldDefinitions;

    // Fix the initial query to start with a default condition
    const initialQuery = {
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
    } satisfies QueryBuilderQuery;

    return {
      fieldDefinitions,
      initialQuery,
    } satisfies UseQueryDefinitionResponse;
  }, [defaultIdentities, handleLoadIdentities, t]);
}

interface SearchMemoryBlocksProps {
  projectId: string;
}

interface CompiledQuery {
  descriptionSearch?: string;
  identifierKeys?: string[];
  labelSearch?: string;
  label?: string;
  valueSearch?: string;
  projectId?: string;
  connectedToAgentsCountGt?: number;
  connectedToAgentsCountLt?: number;
  connectedToAgentsCountEq?: number[];
  limit?: number;
}

const ELEMENT_HEIGHT = 120;

export function UseBlocksServiceInfiniteQuery(compiledQuery: CompiledQuery) {
  return ['infinite', ...UseBlocksServiceListBlocksKeyFn(compiledQuery)];
}

export function SearchMemoryBlocks(props: SearchMemoryBlocksProps) {
  const { projectId } = props;
  const t = useTranslations('ADE/SearchMemoryBlocks');

  const { fieldDefinitions, initialQuery } = useQueryDefinition({
    projectId,
  });
  const [limit, setLimit] = useState<number>(0);

  const [page, setPage] = useState<number>(0);
  const [draftQuery, setDraftQuery] = useState<QueryBuilderQuery>(initialQuery);
  const [query, setQuery] = useState<QueryBuilderQuery>(initialQuery);

  const compiledQuery = useMemo(() => {
    const searchTerms = compileSearchTerms(query.root.items);
    const compiledQuery: CompiledQuery = {};

    searchTerms.forEach((term) => {
      if (term.field === 'name') {
        if (
          term.operator === 'contains' &&
          typeof term.value === 'string' &&
          term.value
        ) {
          compiledQuery.labelSearch =
            (compiledQuery.labelSearch || '') + term.value;
        }

        if (term.operator === 'eq' && typeof term.value === 'string') {
          compiledQuery.label = (compiledQuery.label || '') + term.value;
        }
      }

      if (term.field === 'identity') {
        if (
          term.operator === 'eq' &&
          typeof Array.isArray(term.value) &&
          term.value &&
          term.value.length > 0
        ) {
          compiledQuery.identifierKeys = (
            compiledQuery.identifierKeys || []
          ).concat(term.value);
        }
      }

      if (term.field === 'blockValue') {
        if (
          term.operator === 'contains' &&
          typeof term.value === 'string' &&
          term.value
        ) {
          compiledQuery.valueSearch =
            (compiledQuery.valueSearch || '') + term.value;
        }
      }

      if (term.field === 'blockDescription') {
        if (
          term.operator === 'contains' &&
          typeof term.value === 'string' &&
          term.value
        ) {
          compiledQuery.descriptionSearch =
            (compiledQuery.descriptionSearch || '') + term.value;
        }
      }

      if (term.field === 'attachedAgentsCount') {
        if (term.operator === 'gt' && typeof term.value === 'string') {
          compiledQuery.connectedToAgentsCountGt = parseInt(term.value, 10);
        }
        if (term.operator === 'lt' && typeof term.value === 'string') {
          compiledQuery.connectedToAgentsCountLt = parseInt(term.value, 10);
        }
        if (term.operator === 'eq' && typeof term.value === 'string') {
          compiledQuery.connectedToAgentsCountEq = [
            ...(compiledQuery.connectedToAgentsCountEq || []),
            parseInt(term.value, 10),
          ];
        }
      }
    });

    return {
      ...(projectId ? { projectId } : {}),
      limit,
      ...compiledQuery,
    };
  }, [projectId, query, limit]);

  // Add this line to force QueryBuilder re-render when field definitions change
  const queryBuilderKey = useMemo(() => {
    return JSON.stringify(Object.keys(fieldDefinitions));
  }, [fieldDefinitions]);

  const {
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage: canLoadMorePages,
  } = useInfiniteQuery<
    ListBlocksResponse,
    unknown,
    InfiniteData<ListBlocksResponse>,
    unknown[],
    { after?: string | null }
  >({
    queryKey: UseBlocksServiceInfiniteQuery(compiledQuery),
    queryFn: async ({ pageParam }) => {
      const response = await BlocksService.listBlocks({
        ...compiledQuery,
        limit: limit + 1,
        after: pageParam?.after || undefined,
      });

      return response;
    },
    refetchOnMount: 'always',
    enabled: !!limit,
    initialPageParam: { after: null },
    getNextPageParam: (lastPage) => {
      if (lastPage[limit - 1]) {
        return {
          after: lastPage[limit - 1].id,
        };
      }

      return undefined;
    },
  });

  const currentPage = useMemo(() => {
    return data?.pages[page]?.slice(0, limit) || [];
  }, [data?.pages, limit, page]);

  useEffect(() => {
    setPage(0);
  }, [queryBuilderKey]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const innerContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!innerContentRef.current) {
      return;
    }
    // set limit to the height of the inner content divided by 100

    const containerHeight = innerContentRef.current.clientHeight;
    const heightPlusGap = ELEMENT_HEIGHT + 20; // 20px for padding

    const newLimit = Math.ceil(containerHeight / heightPlusGap); // 50px for each element + 20px for padding

    setLimit(Math.max(newLimit, 3));
  }, []);

  const hasNextPage = useMemo(() => {
    // if on last page and canLoadMorePages
    if (!data?.pages) {
      return false;
    }

    if (page === data.pages.length - 1 && !canLoadMorePages) {
      return false;
    }

    if (!data?.pages?.[page]) {
      return false;
    }

    return data.pages[page].length > limit;
  }, [data, page, limit, canLoadMorePages]);

  return (
    <VStack fullHeight overflow="hidden">
      <div id="search-memory-portal"></div>
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
      <VStack collapseHeight ref={innerContentRef} flex>
        {isLoadingPage ? (
          <>
            {Array.from({ length: limit }, (_, index) => (
              <Skeleton
                /* eslint-disable-next-line react/forbid-component-props */
                style={{ height: ELEMENT_HEIGHT }}
                className="w-full bg-background-grey3 border"
                key={index}
              />
            ))}
          </>
        ) : (
          <>
            {Array.from({ length: limit }, (_, index) => {
              const block = currentPage?.[index];

              if (!block) {
                return (
                  <div key={index} style={{ height: ELEMENT_HEIGHT }}></div>
                );
              }

              return (
                <div key={index} style={{ height: ELEMENT_HEIGHT }}>
                  <MemoryBlock key={block.id} block={block} />
                </div>
              );
            })}
          </>
        )}
      </VStack>
      <HStack fullWidth justify="end" padding="small" borderTop>
        <Button
          type="submit"
          disabled={page === 0 || isFetchingNextPage}
          label={t('prev')}
          color="secondary"
          onClick={() => {
            if (page > 0) {
              setPage((prev) => prev - 1);
            }
          }}
        />
        <Button
          type="submit"
          disabled={!hasNextPage || isFetchingNextPage}
          label={t('next')}
          color="secondary"
          onClick={() => {
            if (hasNextPage) {
              setPage((prev) => prev + 1);
            }
          }}
        />
      </HStack>
    </VStack>
  );
}
