'use client';

import { useTranslations } from '@letta-cloud/translations';
import { Dialog, Typography } from '@letta-cloud/ui-component-library';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  type AbTestTemplatesSchemaType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import { useUserHasPermission } from '$web/client/hooks/useUserHasPermission/useUserHasPermission';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

interface DetachTemplateFromSimulatorProps {
  trigger: React.ReactNode;
  template: AbTestTemplatesSchemaType;
  abTestId: string;
  onSuccess?: () => void;
}

export function DetachTemplateFromSimulator(
  props: DetachTemplateFromSimulatorProps,
) {
  const { trigger, template, abTestId, onSuccess } = props;
  const [open, setOpen] = useState(false);
  const { id: attachedTemplateId } = template;

  const t = useTranslations('projects/ab-tests.DetachTemplateFromSimulator');
  const queryClient = useQueryClient();

  const { mutate, isPending, error } =
    webApi.abTest.detachAbTestTemplate.useMutation({
      onSuccess: () => {
        // Remove the template from the query cache
        queryClient.setQueriesData<
          ServerInferResponses<typeof contracts.abTest.getAbTestTemplates, 200>
        >(
          {
            queryKey: webApiQueryKeys.abTest.getAbTestTemplates(abTestId),
            exact: false,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body,
                templates: oldData.body.templates.filter(
                  (tmpl) => tmpl.id !== attachedTemplateId,
                ),
              },
            };
          },
        );

        setOpen(false);
        if (onSuccess) {
          onSuccess();
        }
      },
    });

  const handleDetach = useCallback(() => {
    if (!abTestId || !attachedTemplateId) {
      return;
    }

    mutate({
      params: {
        abTestId,
        attachedTemplateId,
      },
    });
  }, [mutate, abTestId, attachedTemplateId]);

  const [canUpdateABTest] = useUserHasPermission(
    ApplicationServices.UPDATE_AB_TESTS,
  );

  if (!canUpdateABTest) {
    return null;
  }

  return (
    <Dialog
      testId="detach-template-from-simulator-dialog"
      isOpen={open}
      onOpenChange={setOpen}
      title={t('title')}
      trigger={trigger}
      errorMessage={error ? t('error.default') : undefined}
      isConfirmBusy={isPending}
      confirmText={t('confirm')}
      onConfirm={handleDetach}
    >
      <Typography variant="body2">{t('confirmMessage')}</Typography>
    </Dialog>
  );
}
