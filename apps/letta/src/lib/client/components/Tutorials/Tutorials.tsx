import {
  ActionCard,
  DashboardPageSection,
  NiceGridDisplay,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';

export function Tutorials() {
  const t = useTranslations('components/tutorials');

  return (
    <DashboardPageSection title={t('title')}>
      <NiceGridDisplay>
        <ActionCard
          title={t('createChatBotWithMemory.title')}
          description={t('createChatBotWithMemory.description')}
        />
        <ActionCard
          title={t('buildMultiAgentSystems.title')}
          description={t('buildMultiAgentSystems.description')}
        />
        <ActionCard
          title={t('characterAIApp.title')}
          description={t('characterAIApp.description')}
        />
      </NiceGridDisplay>
    </DashboardPageSection>
  );
}
