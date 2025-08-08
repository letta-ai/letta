'use client';
import {
  HStack,
  NiceGridDisplay,
  Skeleton,
  Typography,
  VStack,
  LettaLoader,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { Section } from '$afd/client/components/Section/Section';
import { useAgentsList } from '../hooks/useAgentsList/useAgentsList';
import React, { Fragment, useMemo } from 'react';
import { AgentFileCard } from '$afd/client/components/AgentFileCard/AgentFileCard';
import { MainCenterView } from '../_components/MainCenterView/MainCenterView';

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

export default function Index() {
  const t = useTranslations('agentfile-directory/index');

  return (
    <Fragment>
      <MainCenterView>
        <VStack
          /* eslint-disable-next-line react/forbid-component-props */
          className="max-w-[800px] p-6  largerThanMobile:p-[56px]"
          fullWidth
          align="center"
        >
          <HStack gap="xlarge" align="center" fullHeight>
            <div className="flex items-center justify-center aspect-square">
              <LettaLoader variant="spinner3d" size="large" isDarkMode={true} />
            </div>
            <VStack>
              <Typography variant="heading1" align="center">
                {t('title')}
              </Typography>
              <HStack align="center">
                ↓<Typography variant="large"> {t('start')}</Typography>
              </HStack>
            </VStack>
          </HStack>
        </VStack>
      </MainCenterView>
      <div className="max-w-[1296px] z-[1] w-full mt-[48px] mx-auto  relative bg-background">
        <VStack paddingBottom>
          <AllAgentsSection />
        </VStack>
      </div>
    </Fragment>
  );
}
