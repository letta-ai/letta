'use client'
import type { DevelopmentServerConfig } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { useDevelopmentServerStatus } from '$web/client/hooks/useDevelopmentServerStatus/useDevelopmentServerStatus';
import React, { useMemo } from 'react';
import semver from 'semver/preload';
import { SUPPORTED_LETTA_AGENTS_VERSIONS } from '$web/constants';
import { StatusIndicator } from '@letta-cloud/ui-component-library';

interface ServerStatusIndicatorProps {
  config: DevelopmentServerConfig;
}

export function SelfHostedStatusIndicator(props: ServerStatusIndicatorProps) {
  const { config } = props;
  const t = useTranslations('development-servers/layout');
  const { isHealthy, version } = useDevelopmentServerStatus(config);

  const isNotCompatible = useMemo(() => {
    if (!version) {
      return false;
    }

    return !semver.satisfies(version, SUPPORTED_LETTA_AGENTS_VERSIONS);
  }, [version]);

  const status = useMemo(() => {
    if (!isHealthy) {
      return 'processing';
    }

    if (isNotCompatible) {
      return 'warning';
    }

    return 'active';
  }, [isHealthy, isNotCompatible]);

  const statusText = useMemo(() => {
    if (isNotCompatible) {
      return t('ServerStatusTitle.incompatible', {
        version: SUPPORTED_LETTA_AGENTS_VERSIONS,
        currentVersion: version,
      });
    }

    return isHealthy
      ? t('ServerStatusTitle.isHealthy')
      : t('ServerStatusTitle.connecting');
  }, [isHealthy, isNotCompatible, t, version]);

  return <StatusIndicator tooltipContent={statusText} status={status} />;
}
