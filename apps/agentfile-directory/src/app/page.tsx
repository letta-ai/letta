'use client';
import {
  Button,
  HStack,
  LettaInvaderOutlineIcon,
  NiceGridDisplay,
  SearchIcon,
  Skeleton,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
// import BannerLight from './banner_light.png';
// import BannerDark from './banner_dark.png';
import { Header } from '../lib/client/components/Header/Header';
import { useTranslations } from '@letta-cloud/translations';
import { Section } from '../lib/client/components/Section/Section';
import { useAgentsList } from './hooks/useAgentsList/useAgentsList';
import { useMemo, useState } from 'react';
import { AgentFileCard } from '../lib/client/components/AgentFileCard/AgentFileCard';

function AllAgentsSection() {
  const t = useTranslations('agentfile-directory/index');

  const { data } = useAgentsList({
    limit: 25,
  });

  const firstPage = useMemo(() => {
    return data?.pages[0];
  }, [data]);

  const totalCount = useMemo(() => {
    return firstPage?.totalCount ? `${firstPage?.totalCount}` : '???';
  }, [firstPage]);

  return (
    <Section seeMoreLink="/search" count={totalCount} title={t('all')}>
      {!firstPage ? (
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
        <NiceGridDisplay itemWidth="292px" itemHeight="155px">
          {firstPage?.items.map((agent) => (
            <AgentFileCard agent={agent} key={agent.agentId} />
          ))}
        </NiceGridDisplay>
      )}
    </Section>
  );
}

function Search() {
  const [search, setSearch] = useState('');
  const t = useTranslations('agentfile-directory/index');

  return (
    <form method="GET" action="/search">
      <HStack
        fullWidth
        align="center"
        gap={false}
        /* eslint-disable-next-line react/forbid-component-props */
        className="bg-background-grey3
            focus-within:bg-background-grey2
            focus-within:outline-1
              w-full
              h-[56px]
              pr-5
            "
      >
        <div className="w-[56px] flex items-center justify-center">
          <SearchIcon />
        </div>
        <input
          name="query"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          className="w-full p-0 focus:outline-none bg-transparent"
          placeholder={t('search')}
        />
        {search.length > 0 && (
          <Button
            size="xsmall"
            color="secondary"
            label={t('go')}
            type="submit"
          />
        )}
      </HStack>
    </form>
  );
}

export default function Index() {
  const t = useTranslations('agentfile-directory/index');

  return (
    <VStack>
      <Header />
      <div className="h-[334px] absolute w-full z-[0] bg-background-grey2 agentheader-background"></div>
      <div className="largerThanMobile:px-[72px] px-4 w-full">
        <div className=" border max-w-[1296px] z-[1] w-full mt-[104px] mx-auto  relative bg-background">
          <VStack
            /* eslint-disable-next-line react/forbid-component-props */
            className="max-w-[600px] p-6  largerThanMobile:p-[56px]"
            fullWidth
            gap="xlarge"
          >
            <LettaInvaderOutlineIcon size="xxlarge" />
            <Typography variant="heading1">{t('title')}</Typography>
            <HStack align="center">
              <Typography variant="large">{t('start')} </Typography>↓
            </HStack>
          </VStack>
          <Search />
        </div>
        <div className="max-w-[1296px] z-[1] w-full mt-[48px] mx-auto  relative bg-background">
          <VStack paddingBottom>
            <AllAgentsSection />
          </VStack>
        </div>
      </div>
    </VStack>
  );
}
