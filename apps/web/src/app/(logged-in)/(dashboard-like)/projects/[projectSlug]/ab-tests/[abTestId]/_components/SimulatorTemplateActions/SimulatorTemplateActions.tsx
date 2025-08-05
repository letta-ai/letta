import { ApplicationServices } from '@letta-cloud/service-rbac';
import {
  Button,
  DotsVerticalIcon,
  DropdownMenu,
  DropdownMenuItem,
} from '@letta-cloud/ui-component-library';
import type { AbTestTemplatesSchemaType } from '@letta-cloud/sdk-web';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useUserHasPermission } from '$web/client/hooks';
import { DetachTemplateFromSimulator } from '../DetachTemplateFromSimulator';
import { useABTestId } from '../../../hooks/useABTestId/useABTestId';

interface SimulatorTemplateActionsProps {
  template: AbTestTemplatesSchemaType;
}

export function SimulatorTemplateActions(props: SimulatorTemplateActionsProps) {
  const { template } = props;

  const abTestId = useABTestId();
  const t = useTranslations('projects/ab-tests.SimulatorTemplateActions');

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
      <DetachTemplateFromSimulator
        abTestId={abTestId}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label={t('delete')}
            color="danger"
          />
        }
        template={template}
      />
    </DropdownMenu>
  );
}
