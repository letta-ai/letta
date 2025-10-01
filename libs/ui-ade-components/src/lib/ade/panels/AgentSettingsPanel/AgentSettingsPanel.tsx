import React, { useMemo } from 'react';
import {
  Button,
  CopyButton,
  EditIcon,
  HStack,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  RawInput,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';

import {
  useAgentBaseTypeName,
  useCurrentAgent,
} from '../../../hooks';
import { useADEState } from '../../../hooks/useADEState/useADEState';
import { useTranslations } from '@letta-cloud/translations';
import { UpdateNameDialog } from '../../../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import { ModelSelector } from '../../inputs/ModelSelector/ModelSelector';
import { SystemPromptEditor } from '../../inputs/SystemPromptEditor/SystemPromptEditor';
import { IdentityViewer } from '../../inputs/IdentityViewer/IdentityViewer';
import { ReasoningSwitch } from '../../inputs/ReasoningSwitch/ReasoningSwitch';
import { LLMConfigPanel } from '../LLMConfigPanel/LLMConfigPanel';
import { ADEAccordionGroup } from '../../../shared/ADEAccordionGroup/ADEAccordionGroup';
import { AgentDescription } from '../../inputs/AgentDescription/AgentDescription';
import { AgentTags } from '../../inputs/AgentTags/AgentTags';

function AgentIdentifierToCopy() {
  const currentAgent = useCurrentAgent();
  const { isTemplate } = useADEState();

  const t = useTranslations('ADE/AgentSettingsPanel');

  const { capitalized: baseName } = useAgentBaseTypeName();

  const identifier = useMemo(() => {
    if (!isTemplate) {
      return currentAgent.id;
    }

    return `${currentAgent.name}:latest`;
  }, [currentAgent.id, currentAgent.name, isTemplate]);

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
        copyButtonText={t('AgentIdentifierToCopy.copyAgentId', { baseName })}
        color="tertiary"
        size="small"
        textToCopy={identifier}
        hideLabel
      />
    </HStack>
  );
}

export function AgentSettingsPanel() {
  const currentAgent = useCurrentAgent();

  const t = useTranslations('ADE/AgentSettingsPanel');
  const tLayout = useTranslations('ADELayout');

  const { capitalized: baseName } = useAgentBaseTypeName();

  if (!currentAgent.llm_config) {
    return <LoadingEmptyStatusComponent emptyMessage="" hideText loaderVariant="grower" isLoading />;
  }

  return (
    <PanelMainContent>
      <VStack gap="small">
        <VStack gap={false}>
          <HStack fullWidth align="end">
            <RawInput
              fullWidth
              label={t('agentName.label')}
              value={currentAgent.name}
              disabled
              size="small"
            />
            <UpdateNameDialog
              trigger={
                <Button
                  size="small"
                  hideLabel
                  data-testid="update-agent-name-button"
                  preIcon={<EditIcon />}
                  color="secondary"
                  label={t('agentName.edit', { baseName })}
                />
              }
            />
          </HStack>
          {/* Agent description below name */}
          <AgentIdentifierToCopy />
        </VStack>

      </VStack>
      <VStack gap="large">
        <AgentDescription />
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

        {/* Embedding config moved to Advanced Settings */}
      </VStack>
    </PanelMainContent>
  );
}
