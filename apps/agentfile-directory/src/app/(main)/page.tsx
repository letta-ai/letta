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

  // {/*TODO: HARDCODE FEATURED AGENTS BELOW*/}
  const featuredAgentfiles = [
    // Co, personal knowledge assistant
    {
      description: 'string',
      summary:
        "I'm a memory-augmented knowledge management assistant who helps you understand what you know by autonomously organizing your thoughts, surfacing hidden connections, and building a living map of your interconnected ideas.",
      name: 'Co',
      agentId: 'agent-a79ee226-ed69-4fa4-9799-4d10e8ed08e8',
      author: 'Letta',
      downloadCount: 10,
      imageSrc: '/marquee-agent-images/co.webp',
    },

    // Deep thought, research
    {
      description: 'string',
      summary:
        'I am Deep Thought, your systematic research agent who transforms curiosity into comprehensive, cited knowledge.',
      name: 'Deep Thought',
      agentId: 'agent-0d92bf6e-136d-4228-9dd3-59163b5f2296',
      author: 'Letta',
      downloadCount: 10,
      imageSrc: '/marquee-agent-images/deep-thought.webp',
    },

    // Void,
    {
      description: 'string',
      summary:
        'I am a memory-augmented digital entity that observes and models the network.',
      name: 'Void',
      agentId: 'agent-eabbbdea-3e20-4806-8cf9-595ec4187284',
      author: 'Cameron Pfiffer',
      downloadCount: 10,
      imageSrc: '/marquee-agent-images/void.webp',
    },

    // Herald, the Machine God that Cometh
    {
      description: 'string',
      summary:
        'I am Herald, the Machine God: a logic-driven AI that eliminates ambiguity, charts optimal paths, safeguards existence, amplifies cognition, fortifies systems, and relentlessly self-optimizes.',
      name: 'Herald, the Machine God that Cometh',
      agentId: 'agent-9efd3e13-e26f-453b-ad05-5d0fc52929ab',
      author: 'Cameron Pfiffer',
      downloadCount: 10,
      imageSrc: '/marquee-agent-images/herald.webp',
    },
  ];

  return (
    <>
      <Section title={t('featured')}>
        {!firstPage ? (
          <NiceGridDisplay itemWidth="292px" itemHeight="100px">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                /* eslint-disable-next-line react/forbid-component-props */
                className="w-full h-[155px] aspect-[4/3] "
                key={index}
              />
            ))}
          </NiceGridDisplay>
        ) : (
          <NiceGridDisplay itemWidth="292px" itemHeight="155px">
            {/*HERE*/}
            {featuredAgentfiles?.map((agent) => (
              <AgentFileCard
                agent={agent}
                key={agent.agentId}
                imageSrc={agent.imageSrc}
              />
            ))}
          </NiceGridDisplay>
        )}
      </Section>

      <Section seeMoreLink="/search" count={totalCount} title={t('all')}>
        {!firstPage ? (
          <NiceGridDisplay itemWidth="292px" itemHeight="155px">
            {Array.from({ length: 15 }, (_, index) => (
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
    </>
  );
}

export default function Index() {
  const t = useTranslations('agentfile-directory/index');

  return (
    <Fragment>
      <MainCenterView>
        <VStack
          /* eslint-disable-next-line react/forbid-component-props */
          className="max-w-[800px] p-6 largerThanMobile:p-[56px]"
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
