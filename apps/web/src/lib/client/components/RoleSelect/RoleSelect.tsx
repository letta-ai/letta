import React, { useCallback, useMemo } from 'react';
import { UserPresetRoles } from '@letta-cloud/rbac';
import { useTranslations } from '@letta-cloud/translations';
import type {
  SelectProps,
  MakeInputProps,
} from '@letta-cloud/component-library';
import { Select } from '@letta-cloud/component-library';

export function useGetLabelForRole() {
  const t = useTranslations('roles');

  return useCallback(
    (role: string) => {
      switch (role) {
        case 'admin':
          return t('admin');
        case 'editor':
          return t('editor');
        case 'custom':
          return t('custom');
        default:
          return role;
      }
    },
    [t],
  );
}

export function RoleSelect(
  props: Omit<MakeInputProps<SelectProps>, 'options'>,
) {
  const getLabelForRole = useGetLabelForRole();
  const roleOptions = useMemo(() => {
    return Object.values(UserPresetRoles.Enum)
      .map((role) => ({
        value: role,
        label: getLabelForRole(role),
      }))
      .filter((role) => role.value !== 'custom');
  }, [getLabelForRole]);

  return <Select {...props} labelVariant="simple" options={roleOptions} />;
}
