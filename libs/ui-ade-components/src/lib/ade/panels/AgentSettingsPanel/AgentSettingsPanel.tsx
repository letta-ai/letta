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
import { OnboardingAsideFocus } from '../../../OnboardingAsideFocus/OnboardingAsideFocus';

import {
  useAgentBaseTypeName,
  useCurrentAgent,
} from '../../../hooks';
import { useADEState } from '../../../hooks/useADEState/useADEState';
import { useTranslations } from '@letta-cloud/translations';
import { UpdateNameDialog } from '../../../shared/UpdateAgentNameDialog/UpdateAgentNameDialog';
import { useADETour } from '../../../hooks/useADETour/useADETour';
import { ModelSelector } from './ModelSelector/ModelSelector';
import { SystemPromptEditor } from '../../inputs/SystemPromptEditor/SystemPromptEditor';
import { IdentityViewer } from '../../inputs/IdentityViewer/IdentityViewer';
import { ReasoningSwitch } from '../../inputs/ReasoningSwitch/ReasoningSwitch';

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

interface AgentSettingsOnboardingProps {
  children: React.ReactNode;
}

export function AgentSettingsOnboarding(props: AgentSettingsOnboardingProps) {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const { children } = props;

  const { currentStep, setStep } = useADETour();

  if (currentStep !== 'template') {
    return <>{children}</>;
  }

  return (
    <OnboardingAsideFocus
      className="w-full h-full"
      title={t('AgentSettingsOnboarding.title')}
      placement="right-start"
      description={t('AgentSettingsOnboarding.description')}
      isOpen
      totalSteps={4}
      nextStep={
        <Button
          fullWidth
          size="large"
          bold
          onClick={() => {
            setStep('core_memories');
          }}
          label={t('AgentSettingsOnboarding.next')}
        />
      }
      currentStep={1}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

export function AgentSettingsPanel() {
  const currentAgent = useCurrentAgent();

  const t = useTranslations('ADE/AgentSettingsPanel');

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
          <AgentIdentifierToCopy />
        </VStack>

        <ModelSelector llmConfig={currentAgent.llm_config} />

      </VStack>
      <VStack gap="large">
        <ReasoningSwitch />
        <IdentityViewer />
        <SystemPromptEditor />
      </VStack>
    </PanelMainContent>
  );
}
