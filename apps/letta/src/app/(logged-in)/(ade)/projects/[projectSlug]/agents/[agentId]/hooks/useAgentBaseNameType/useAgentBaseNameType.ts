import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useTranslations } from 'next-intl';

export function useAgentBaseTypeName() {
  const { isTemplate } = useCurrentAgentMetaData();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  if (isTemplate) {
    return {
      capitalized: t('agentBaseType.capitalized.template'),
      base: t('agentBaseType.base.template'),
    };
  }

  return {
    capitalized: t('agentBaseType.capitalized.agent'),
    base: t('agentBaseType.base.agent'),
  };
}
