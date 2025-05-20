import * as React from 'react';
import type { JobStatus } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import type { BadgeProps } from '../../core/Badge/Badge';
import { Badge } from '../../core/Badge/Badge';

interface JobStatusBadgeProps extends Omit<BadgeProps, 'content'> {
  status: JobStatus;
}

export function JobStatusBadge(props: JobStatusBadgeProps) {
  const { status } = props;
  const t = useTranslations('components/JobStatusBadge');

  const statusText = useMemo(() => {
    return {
      not_started: t('not_started'),
      created: t('created'),
      running: t('running'),
      completed: t('completed'),
      failed: t('failed'),
      pending: t('pending'),
      cancelled: t('cancelled'),
      expired: t('expired'),
    }[status];
  }, [status, t]);

  const statusVariant = useMemo(() => {
    const map: Record<JobStatus, BadgeProps['variant']> = {
      not_started: 'info',
      created: 'info',
      running: 'info',
      completed: 'success',
      failed: 'destructive',
      pending: 'warning',
      cancelled: 'warning',
      expired: 'warning',
    };

    return map[status];
  }, [status]);

  return <Badge {...props} content={statusText} variant={statusVariant} />;
}
