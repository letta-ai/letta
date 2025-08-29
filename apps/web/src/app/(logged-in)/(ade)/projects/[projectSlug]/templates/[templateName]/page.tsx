'use client';
import { CloudAgentEditor } from '$web/client/components/CloudAgentEditor/CloudAgentEditor';
import { ADEError } from '$web/client/components/ADEError/ADEError';
import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { GoingToADEView } from '$web/client/components/GoingToADEView/GoingToADEView';

export default function TemplatePage() {
  const searchParams = useSearchParams();

  const optimisticTemplateCreation = useMemo(() => {
    const param = searchParams.get('ensure');
    if (param === 'true') return true;
    return false;
  }, [searchParams]);

  const { templateName, projectSlug } = useParams<{
    templateName: string;
    projectSlug: string;
  }>();

  const { data: template, isLoading } =
    cloudAPI.templates.getTemplateSnapshot.useQuery({
      queryKey: cloudQueryKeys.templates.getTemplateSnapshot(
        projectSlug,
        `${templateName}:latest`,
      ),
      queryData: {
        params: {
          project: projectSlug,
          template_version: `${templateName}:latest`,
        },
      },
      enabled: !!templateName && !!projectSlug,
      retry: optimisticTemplateCreation,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    });

  if (optimisticTemplateCreation && isLoading) {
    return <GoingToADEView mode="template" />
  }

  if (!template && !isLoading) {
    return <ADEError errorCode="templateNotFound" />;
  }

  return <CloudAgentEditor />;
}
