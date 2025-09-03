import React from 'react';
import {
  LoadingEmptyStatusComponent,
  PanelMainContent,
  VStack,
} from '@letta-cloud/ui-component-library';

import {
  useCurrentAgent,
} from '../../../hooks';
import { TemplateName } from '../../inputs/TemplateName/TemplateName';
import { TemplateDescription } from '../../inputs/TemplateDescription';

export function TemplateSettingsPanel() {
  const currentAgent = useCurrentAgent();

  if (!currentAgent.name) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        hideText
        loaderVariant="grower"
        isLoading
      />
    );
  }

  return (
    <PanelMainContent>
      <VStack gap="small">
        <TemplateName />
        <TemplateDescription />
      </VStack>
    </PanelMainContent>
  );
}
