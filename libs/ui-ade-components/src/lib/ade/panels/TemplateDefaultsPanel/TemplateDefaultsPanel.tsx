import React from 'react';
import {
  PanelMainContent,
  VStack,
} from '@letta-cloud/ui-component-library';
import { IdentityViewer } from '../../inputs/IdentityViewer/IdentityViewer';
import { AgentTags } from '../../inputs/AgentTags/AgentTags';


export function TemplateDefaultsPanel() {
  return (
    <PanelMainContent>
      <VStack gap="large">
        <IdentityViewer />
        <AgentTags />
      </VStack>
    </PanelMainContent>
  );
}
