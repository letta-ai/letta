import {
  EarthIcon,
  isMultiValue,
  LockClosedIcon,
  OfficesIcon,
  Select,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useMemo } from 'react';

export type AccessLevelValue = 'logged-in' | 'organization' | 'public';

interface AccessLevelSelectProps {
  value: AccessLevelValue;
  onChange: (value: AccessLevelValue) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  rightOfLabelContent?: React.ReactNode;
}

/**
 * AccessLevelSelect - A shared component for selecting access levels
 *
 * Provides consistent options and icons for access level selection across the application.
 * Supports organization, logged-in, and public access levels.
 *
 * @example
 * <AccessLevelSelect
 *   value="organization"
 *   onChange={(value) => console.log(value)}
 *   label="Access Level"
 *   description="Choose who can access this resource"
 * />
 */
export function AccessLevelSelect(props: AccessLevelSelectProps) {
  const {
    value,
    onChange,
    label,
    description,
    disabled = false,
    fullWidth = true,
    rightOfLabelContent,
  } = props;

  const t = useTranslations('shared/AccessLevelSelect');

  const options = useMemo(() => {
    return [
      {
        label: t('options.organization'),
        value: 'organization' as const,
        icon: <OfficesIcon />,
      },
      {
        label: t('options.logged-in'),
        value: 'logged-in' as const,
        icon: <LockClosedIcon />,
      },
      {
        label: t('options.public'),
        value: 'public' as const,
        icon: <EarthIcon />,
      },
    ];
  }, [t]);

  const getOption = useCallback(
    (value: AccessLevelValue) => {
      return options.find((option) => option.value === value);
    },
    [options],
  );

  const handleSelect = useCallback(
    (option: any) => {
      if (isMultiValue(option) || !option) {
        return;
      }
      onChange(option.value as AccessLevelValue);
    },
    [onChange],
  );

  return (
    <Select
      fullWidth={fullWidth}
      disabled={disabled}
      rightOfLabelContent={rightOfLabelContent}
      label={label || t('label')}
      description={description || t('description')}
      options={options}
      onSelect={handleSelect as any}
      value={getOption(value)}
    />
  );
}

/**
 * Hook to get access level options for use in other components
 */
export function useAccessLevelOptions() {
  const t = useTranslations('shared/AccessLevelSelect');

  return useMemo(
    () => [
      {
        label: t('options.organization'),
        value: 'organization' as const,
        icon: <OfficesIcon />,
      },
      {
        label: t('options.logged-in'),
        value: 'logged-in' as const,
        icon: <LockClosedIcon />,
      },
      {
        label: t('options.public'),
        value: 'public' as const,
        icon: <EarthIcon />,
      },
    ],
    [t],
  );
}
