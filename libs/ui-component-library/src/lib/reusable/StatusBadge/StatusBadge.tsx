import { Badge } from '../../core/Badge/Badge';
import { useTranslations } from '@letta-cloud/translations';
import { Spinner } from '../../core/Spinner/Spinner';
import { useMemo } from 'react';
import { CheckCircleFilledIcon, WarningIcon } from '../../icons';

interface StatusBadgeProps {
  status?: string;
  toolReturn?: string;
}

export function StatusBadge(props: StatusBadgeProps) {
  const { status, toolReturn } = props;

  const t = useTranslations('ui-component-library/FunctionCall');

  const statusInfo = useMemo(() => {
    if (status === 'success') {
      return {
        message: t('success'),
        color: 'success' as const,
        icon: <CheckCircleFilledIcon size="xsmall" />,
      };
    }

    if (!toolReturn && status !== 'error') {
      return {
        message: t('isExecuting'),
        color: 'warning' as const,
        icon: <Spinner size="xsmall" />,
      };
    }

    return {
      message: t('error'),
      color: 'destructive' as const,
      icon: <WarningIcon size="xsmall" />,
    };
  }, [toolReturn, status, t]);

  return (
    <Badge
      preIcon={statusInfo.icon}
      content={statusInfo.message}
      variant={statusInfo.color}
      size="small"
      border
    />
  );
}
