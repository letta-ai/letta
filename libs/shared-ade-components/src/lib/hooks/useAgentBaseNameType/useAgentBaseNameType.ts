import { useCurrentAgentMetaData } from '../useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useTranslations } from '@letta-cloud/translations';

export function useAgentBaseTypeName() {
  const { isTemplate } = useCurrentAgentMetaData();
  const t = useTranslations('agentBaseType');

  if (isTemplate) {
    return {
      capitalized: t('capitalized.template'),
      base: t('base.template'),
    };
  }

  return {
    capitalized: t('capitalized.agent'),
    base: t('base.agent'),
  };
}
