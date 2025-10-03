import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { RoleOption } from './AgentMessengerRoleSelector/AgentMessengerRoleSelector';

export function useDefaultRole(): RoleOption {
  const t = useTranslations('AgentMessenger/AgentMessengerRoleSelector');

  return useMemo(() => ({
    value: 'user',
    label: t('role.user'),
    identityId: 'placeholderId',
  }), [t]);
}
