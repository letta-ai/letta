import {
  DashboardPageSection,
  ImageCard,
  NiceGridDisplay,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import memory from './memory.png';
import discord from './discord.png';
import multiagent from './multiagent.png';
import voice from './voice.png';

export function Tutorials() {
  const t = useTranslations('components/tutorials');

  return (
    <DashboardPageSection title={t('title')}>
      <NiceGridDisplay>
        <ImageCard
          imageUrl={memory}
          altText=""
          title={t('createChatBotWithMemory.title')}
          description={t('createChatBotWithMemory.description')}
        />
        <ImageCard
          imageUrl={multiagent}
          altText=""
          title={t('buildMultiAgentSystems.title')}
          description={t('buildMultiAgentSystems.description')}
        />
        <ImageCard
          imageUrl={discord}
          altText=""
          title={t('discord.title')}
          description={t('discord.description')}
        />
        <ImageCard
          imageUrl={voice}
          altText=""
          title={t('voice.title')}
          description={t('voice.description')}
        />
      </NiceGridDisplay>
    </DashboardPageSection>
  );
}
