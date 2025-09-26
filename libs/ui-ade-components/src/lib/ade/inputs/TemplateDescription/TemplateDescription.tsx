'use client'
import React, { useCallback, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useDebouncedCallback } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useADEPermissions } from '../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { RawTextArea, Spinner } from '@letta-cloud/ui-component-library';
import { useParams } from 'next/navigation';
import { useCurrentTemplate } from '../../../hooks/useCurrentTemplate/useCurrentTemplate';

export function TemplateDescription() {
  const { template, isLoading } = useCurrentTemplate();
  const { projectSlug, templateName } = useParams<{
    projectSlug: string;
    templateName: string;
  }>();

  const [localDescription, setLocalDescription] = useState(template?.description || '');

  const t = useTranslations('ADE/TemplateDescription');

  const { mutate, isPending } = cloudAPI.templates.updateTemplateDescription.useMutation();

  const queryClient = useQueryClient();

  const debouncedMutation = useDebouncedCallback((description: string) => {
    if (!projectSlug || !templateName) return;

    mutate({
      params: {
        project_id: projectSlug,
        template_name: templateName,
      },
      body: {
        description,
      },
    }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: cloudQueryKeys.templates.listTemplates,
          exact: false,
        });
      },
    });
  }, 500);

  const handleUpdate = useCallback(
    (description: string) => {
      setLocalDescription(description);
      debouncedMutation(description);
    },
    [debouncedMutation],
  );

  const [canUpdateTemplate] = useADEPermissions(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES);

  // Update local state when template data changes
  React.useEffect(() => {
    if (template?.description !== undefined) {
      setLocalDescription(template.description);
    }
  }, [template?.description]);

  if (isLoading) {
    return <Spinner size="small" />;
  }

  return (
    <RawTextArea
      onChange={(e) => {
        handleUpdate(e.target.value);
      }}
      disabled={!canUpdateTemplate}
      rightOfLabelContent={isPending ? <Spinner size="xsmall" /> : null}
      placeholder={t('TemplateDescription.placeholder')}
      rows={2}
      value={localDescription || ''}
      fullWidth
      variant="secondary"
      resize="none"
      autosize
      maxRows={4}
      minRows={2}
      label={t('TemplateDescription.label')}
      infoTooltip={{
        text: t('TemplateDescription.tooltip'),
      }}
    />
  );
}
