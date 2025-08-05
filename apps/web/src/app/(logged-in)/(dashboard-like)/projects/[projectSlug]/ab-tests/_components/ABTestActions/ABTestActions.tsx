import { ApplicationServices } from '@letta-cloud/service-rbac';
import {
  Button,
  DotsVerticalIcon,
  DropdownMenu,
  DropdownMenuItem,
} from '@letta-cloud/ui-component-library';
import type { AbTestType } from '@letta-cloud/sdk-web';
import React, { useCallback } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { UpdateABTestNameDialog } from '../UpdateABTestNameDialog/UpdateABTestNameDialog';
import { useUserHasPermission } from '$web/client/hooks';
import { UpdateDescriptionEditor } from '../UpdateDescriptionEditor/UpdateDescriptionEditor';
import { ConfirmDeleteABTestDialog } from '../ConfirmDeleteABTestDialog';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useABTestId } from '../../hooks/useABTestId/useABTestId';

interface ABTestHeaderActionsProps {
  abTest: AbTestType;
}

export function ABTestActions(props: ABTestHeaderActionsProps) {
  const { abTest } = props;

  const t = useTranslations('projects/ab-tests.ABTestHeaderActions');

  const { slug } = useCurrentProject();
  const abTestId = useABTestId();

  const handleRedirectOnClose = useCallback(() => {
    // if we're on the AB test page, redirect to the project AB tests list
    if (abTestId) {
      window.location.href = `/projects/${slug}/ab-tests`;
    }
  }, [abTestId, slug]);

  const [canUpdateABTests] = useUserHasPermission(
    ApplicationServices.UPDATE_AB_TESTS,
  );

  if (!canUpdateABTests) {
    return null;
  }

  return (
    <DropdownMenu
      align="start"
      triggerAsChild
      trigger={
        <Button
          size="small"
          preIcon={<DotsVerticalIcon />}
          label={t('trigger')}
          hideLabel
          color="tertiary"
        />
      }
    >
      <UpdateABTestNameDialog
        abTest={abTest}
        trigger={
          <DropdownMenuItem doNotCloseOnSelect label={t('updateName')} />
        }
      />
      <UpdateDescriptionEditor
        abTest={abTest}
        trigger={
          <DropdownMenuItem doNotCloseOnSelect label={t('updateDescription')} />
        }
      />
      <ConfirmDeleteABTestDialog
        abTest={abTest}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label={t('deleteABTest')}
            color="danger"
          />
        }
        onSuccess={() => {
          handleRedirectOnClose();
        }}
      />
    </DropdownMenu>
  );
}
