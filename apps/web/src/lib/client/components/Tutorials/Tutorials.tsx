import {
  Badge,
  DashboardPageSection,
  NiceGridDisplay,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import memory from './memory.webp';
import discord from './discord.webp';
import multiagent from './multiagent.webp';
import voice from './voice.webp';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import * as React from 'react';
import { DashboardCard } from '$web/client/components';

interface TutorialImageProps {
  src: ImageProps['src'];
}

function TutorialImage(props: TutorialImageProps) {
  const { src } = props;
  return (
    <Image
      /* eslint-disable-next-line react/forbid-component-props */
      className="min-h-[72px] max-w-[72px] object-cover bg-background-grey"
      src={src}
      alt=""
    />
  );
}

export function Tutorials() {
  const t = useTranslations('components/tutorials');

  return (
    <DashboardPageSection description={t('description')} title={t('title')}>
      <NiceGridDisplay itemWidth="318px" itemHeight="112px">
        <DashboardCard
          largeImage={<TutorialImage src={memory} />}
          title={t('createChatBotWithMemory.title')}
          description={t('createChatBotWithMemory.description')}
          badge={<Badge size="small" content={t('comingSoon')} />}
        />
        <DashboardCard
          largeImage={<TutorialImage src={multiagent} />}
          title={t('buildMultiAgentSystems.title')}
          description={t('buildMultiAgentSystems.description')}
          badge={<Badge size="small" content={t('comingSoon')} />}
        />
        <DashboardCard
          largeImage={<TutorialImage src={discord} />}
          title={t('discord.title')}
          description={t('discord.description')}
          badge={<Badge size="small" content={t('comingSoon')} />}
        />
        <DashboardCard
          largeImage={<TutorialImage src={voice} />}
          title={t('voice.title')}
          description={t('voice.description')}
          badge={<Badge size="small" content={t('comingSoon')} />}
        />
      </NiceGridDisplay>
    </DashboardPageSection>
  );
}
