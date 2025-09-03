import React from 'react';
import { PanelMainContent } from '@letta-cloud/ui-component-library';
import { AgentDescription } from '../../inputs/AgentDescription/AgentDescription';
import { AgentTags } from '../../inputs/AgentTags/AgentTags';

export function MetadataPanel() {
  return (
    <PanelMainContent>
      <AgentTags />
      <AgentDescription />
    </PanelMainContent>
  );
}
