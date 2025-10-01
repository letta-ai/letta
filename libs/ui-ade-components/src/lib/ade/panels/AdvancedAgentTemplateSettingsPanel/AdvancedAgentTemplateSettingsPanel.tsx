import React from 'react';
import {
  PanelMainContent, Typography,
} from '@letta-cloud/ui-component-library';
import { SharedAdvancedSettings } from '../SharedAdvancedSettings/SharedAdvancedSettings';
import { EmbeddingConfiguration } from '../../inputs/EmbeddingConfiguration/EmbeddingConfiguration';
import { useTranslations } from '@letta-cloud/translations';


export function AdvancedAgentTemplateSettingsPanel() {
  const t = useTranslations('ADE/AdvancedAgentTemplateSettingsPanel');
  const tLayout = useTranslations('ADELayout');
  return (
    <PanelMainContent>
      <Typography bold variant="body3">
        {t('advanced')}
      </Typography>
      <SharedAdvancedSettings />
      <EmbeddingConfiguration label={tLayout('embeddingConfig')} />
    </PanelMainContent>
  );
}
