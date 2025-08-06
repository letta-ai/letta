'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { MainCenterView } from '../../_components/MainCenterView/MainCenterView';
import {
  HStack,
  NiceGridDisplay,
  PageSelector,
  RawInput,
  Skeleton,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { useAgentsList } from '../../hooks/useAgentsList/useAgentsList';
import { AgentFileCard } from '$afd/client/components/AgentFileCard/AgentFileCard';
import { useDebouncedValue } from '@mantine/hooks';

interface SearchContainerProps {
  search: string;
  setSearch: (search: string) => void;
  totalCount: string;
}

function SearchContainer(props: SearchContainerProps) {
  const { setSearch, search } = props;
  const t = useTranslations('agentfile-directory/search');

  return (
    <VStack
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[260px]"
      align="center"
      justify="center"
    >
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
        className="max-w-[405px]"
        fullWidth
      >
        <RawInput
          /* eslint-disable-next-line react/forbid-component-props */
          className="border-base"
          fullWidth
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          label={t('label')}
          hideLabel
          placeholder={t('placeholder')}
        />
      </VStack>
    </VStack>
  );
}

const PAGE_LIMIT = 25;

export default function SearchResults() {
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => {
    return searchParams.get('query') || '';
  });
  const [page, setPage] = useState(0);
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data, isFetchingNextPage, fetchNextPage } = useAgentsList({
    limit: PAGE_LIMIT,
    search: debouncedSearch,
  });

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const totalPages = useMemo(() => {
    if (!data?.pages) {
      return 0;
    }

    return Math.floor((data.pages[0].totalCount || 0) / PAGE_LIMIT) + 1;
  }, [data]);

  const totalCount = useMemo(() => {
    return data?.pages[0]?.totalCount ? `${data?.pages[0]?.totalCount}` : '???';
  }, [data]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.[page]?.items?.slice(0, PAGE_LIMIT) || [];
  }, [data, page]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  return (
    <Fragment>
      <MainCenterView>
        <SearchContainer
          totalCount={totalCount}
          search={search}
          setSearch={setSearch}
        />
      </MainCenterView>
      <div className="max-w-[1296px] z-[1] w-full mt-[48px] mx-auto  relative bg-background">
        <VStack paddingBottom>
          {isLoadingPage ? (
            <NiceGridDisplay itemWidth="292px" itemHeight="155px">
              {new Array(15).fill(0).map((_, index) => (
                <Skeleton
                  /* eslint-disable-next-line react/forbid-component-props */
                  className="w-full h-[155px] aspect-[4/3] "
                  key={index}
                />
              ))}
            </NiceGridDisplay>
          ) : (
            <VStack>
              {filteredData.length > 0 && (
                <Fragment>
                  <NiceGridDisplay itemWidth="292px" itemHeight="155px">
                    {filteredData.map((agent) => (
                      <AgentFileCard agent={agent} key={agent.agentId} />
                    ))}
                  </NiceGridDisplay>
                  <HStack justify="end">
                    <PageSelector
                      onPageChange={(pageNumber: number) => {
                        setPage(pageNumber - 1);

                        if (pageNumber > data?.pages?.length) {
                          void fetchNextPage();
                        }
                      }}
                      visiblePageCount={0}
                      totalPages={totalPages}
                      currentPage={page + 1}
                    />
                  </HStack>
                </Fragment>
              )}
            </VStack>
          )}
        </VStack>
      </div>
    </Fragment>
  );
}
