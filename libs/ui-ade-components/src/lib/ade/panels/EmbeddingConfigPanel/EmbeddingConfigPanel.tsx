import { PanelMainContent } from '@letta-cloud/ui-component-library';
import React from 'react';
import { EmbeddingConfiguration } from '../../inputs/EmbeddingConfiguration/EmbeddingConfiguration';

export function EmbeddingConfigPanel() {
  return (
    <PanelMainContent>
      <EmbeddingConfiguration />
    </PanelMainContent>
  );
}
