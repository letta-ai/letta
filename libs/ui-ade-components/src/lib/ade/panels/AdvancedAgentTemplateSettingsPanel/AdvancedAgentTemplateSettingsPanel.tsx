import React from 'react';
import {
  PanelMainContent, Typography,
  VStack,
  HR,
} from '@letta-cloud/ui-component-library';
import { IdentityViewer } from '../../inputs/IdentityViewer/IdentityViewer';
import { AgentTags } from '../../inputs/AgentTags/AgentTags';
import { SharedAdvancedSettings } from '../SharedAdvancedSettings/SharedAdvancedSettings';
import { useTranslations } from '@letta-cloud/translations';


export function AdvancedAgentTemplateSettingsPanel() {
  const t = useTranslations('ADE/AdvancedAgentTemplateSettingsPanel')
  return (
    <PanelMainContent>
      <VStack gap="large">
        <Typography bold variant="body3">
          {t('defaults')}
        </Typography>
        <IdentityViewer />
        <AgentTags />
      </VStack>
      <HR />
      <Typography bold variant="body3">
        {t('advanced')}
      </Typography>
      <SharedAdvancedSettings />
    </PanelMainContent>
  );
}
