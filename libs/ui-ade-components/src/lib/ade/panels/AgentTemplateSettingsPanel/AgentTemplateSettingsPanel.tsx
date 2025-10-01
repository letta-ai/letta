import React from 'react';
import {
  LoadingEmptyStatusComponent,
  PanelMainContent,
  VStack,
} from '@letta-cloud/ui-component-library';

import { useCurrentAgent } from '../../../hooks';
import { ModelSelector } from '../../inputs/ModelSelector/ModelSelector';
import { SystemPromptEditor } from '../../inputs/SystemPromptEditor/SystemPromptEditor';
import { ReasoningSwitch } from '../../inputs/ReasoningSwitch/ReasoningSwitch';
import { LLMConfigPanel } from '../LLMConfigPanel/LLMConfigPanel';
import { IdentityViewer } from '../../inputs/IdentityViewer/IdentityViewer';
import { AgentTags } from '../../inputs/AgentTags/AgentTags';
import { ADEAccordionGroup } from '../../../shared/ADEAccordionGroup/ADEAccordionGroup';
import { TemplateName } from '../../inputs/TemplateName/TemplateName';
import { TemplateDescription } from '../../inputs/TemplateDescription';
import { useTranslations } from '@letta-cloud/translations';

export function AgentTemplateSettingsPanel() {
  const currentAgent = useCurrentAgent();
  const tLayout = useTranslations('ADELayout');

  if (!currentAgent.llm_config) {
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
        {/* Name and description for template */}
        <TemplateName />
        <TemplateDescription />
      </VStack>
      <VStack gap="large">
        {/* Model and system instructions */}
        <ModelSelector llmConfig={currentAgent.llm_config} />
        <SystemPromptEditor />

        {/* Metadata (collapsible): identities + tags */}
        <ADEAccordionGroup
          panels={[
            {
              id: 'metadata',
              label: tLayout('metadata'),
              content: (
                <VStack gap="large">
                  <IdentityViewer />
                  <AgentTags />
                </VStack>
              ),
              defaultOpen: false,
            },
          ]}
        />

        {/* LLM Configuration (collapsible) */}
        <ADEAccordionGroup
          panels={[
            {
              id: 'llm-config',
              label: tLayout('llmConfig'),
              content: (
                <VStack gap="large">
                  <ReasoningSwitch />
                  <LLMConfigPanel />
                </VStack>
              ),
              defaultOpen: false,
            },
          ]}
        />
      </VStack>
    </PanelMainContent>
  );
}
