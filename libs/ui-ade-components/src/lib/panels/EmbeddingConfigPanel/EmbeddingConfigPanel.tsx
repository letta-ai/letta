import { PanelMainContent } from '@letta-cloud/ui-component-library';
import React from 'react';
import { EmbeddingConfiguration } from '../AdvancedSettingsPanel/components/EmbeddingConfiguration/EmbeddingConfiguration';

export function EmbeddingConfigPanel() {
  return (
    <PanelMainContent>
      <EmbeddingConfiguration />
    </PanelMainContent>
  );
}
