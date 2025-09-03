import React, { useMemo } from 'react';
import {
  Button,
  CopyButton,
  EditIcon,
  HStack,
  RawInput,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { UpdateTemplateNameDialog } from '../../../shared/UpdateTemplateNameDialog/UpdateTemplateNameDialog';
import { useADEAppContext } from '../../../AppContext/AppContext';
import { useCurrentAgent } from '../../../hooks';

function TemplateIdentifierToCopy() {
  const currentAgent = useCurrentAgent();

  const { projectSlug } = useADEAppContext();

  const t = useTranslations('ADE/TemplateSettingsPanel');

  const identifier = useMemo(() => {
    return `${projectSlug}/${currentAgent.name}:latest`;
  }, [projectSlug, currentAgent]);

  return (
    <HStack fullWidth align="center">
      <Typography
        noWrap
        overflow="ellipsis"
        align="left"
        font="mono"
        color="muted"
        variant="body4"
      >
        {identifier}
      </Typography>
      <CopyButton
        copyButtonText={t('copyTemplateName')}
        color="tertiary"
        size="small"
        textToCopy={identifier}
        hideLabel
      />
    </HStack>
  );
}

export function TemplateName() {
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/TemplateSettingsPanel');

  return (
    <VStack gap={false}>
      <HStack fullWidth align="end">
        <RawInput
          fullWidth
          label={t('templateName.label')}
          value={currentAgent.name}
          disabled
          size="small"
        />
        <UpdateTemplateNameDialog
          trigger={
            <Button
              size="small"
              hideLabel
              data-testid="update-template-name-button"
              preIcon={<EditIcon />}
              color="secondary"
              label={t('templateName.edit')}
            />
          }
        />
      </HStack>
      <TemplateIdentifierToCopy />
    </VStack>
  );
}
