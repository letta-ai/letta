import {
  Badge,
  DashboardPageSection,
  ImageCard,
  NiceGridDisplay,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import memory from './memory.webp';
import discord from './discord.webp';
import multiagent from './multiagent.webp';
import voice from './voice.webp';

export function Tutorials() {
  const t = useTranslations('components/tutorials');

  return (
    <DashboardPageSection description={t('description')} title={t('title')}>
      <NiceGridDisplay>
        <ImageCard
          imageUrl={memory}
          altText=""
          title={t('createChatBotWithMemory.title')}
          description={t('createChatBotWithMemory.description')}
          badge={<Badge content={t('comingSoon')} />}
        />
        <ImageCard
          imageUrl={multiagent}
          altText=""
          title={t('buildMultiAgentSystems.title')}
          description={t('buildMultiAgentSystems.description')}
          badge={<Badge content={t('comingSoon')} />}
        />
        <ImageCard
          imageUrl={discord}
          altText=""
          title={t('discord.title')}
          description={t('discord.description')}
          badge={<Badge content={t('comingSoon')} />}
        />
        <ImageCard
          imageUrl={voice}
          altText=""
          title={t('voice.title')}
          description={t('voice.description')}
          badge={<Badge content={t('comingSoon')} />}
        />
      </NiceGridDisplay>
    </DashboardPageSection>
  );
}
