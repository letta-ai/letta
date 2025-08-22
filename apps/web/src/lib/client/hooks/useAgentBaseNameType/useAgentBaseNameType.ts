import { useTranslations } from '@letta-cloud/translations';
import { useADEState } from '@letta-cloud/ui-ade-components';

export function useAgentBaseTypeName() {
  const { isTemplate } = useADEState();
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
