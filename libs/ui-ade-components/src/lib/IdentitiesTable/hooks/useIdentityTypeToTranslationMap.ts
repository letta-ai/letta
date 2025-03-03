import { useTranslations } from '@letta-cloud/translations';

export function useIdentityTypeToTranslationMap() {
  const t = useTranslations('IdentitiesTable');

  return {
    org: t('identityTypes.org'),
    user: t('identityTypes.user'),
    other: t('identityTypes.other'),
  };
}
