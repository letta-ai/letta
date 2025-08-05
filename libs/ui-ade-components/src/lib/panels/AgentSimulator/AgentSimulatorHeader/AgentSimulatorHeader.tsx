import {
  Badge,
  Button,
  HStack,
  InfoTooltip,
  Spinner,
  Tooltip,
  Typography,
  VariableIcon,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { AgentVariablesModal } from '../AgentVariablesModal/AgentVariablesModal';
import React, { useMemo } from 'react';
import {
  useCurrentSimulatedAgent,
  useCurrentSimulatedAgentVariables,
} from '../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { getIsAgentState } from '@letta-cloud/sdk-core';
import { findMemoryBlockVariables } from '@letta-cloud/utils-shared';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../hooks';
import { ControlChatroomRenderMode } from '../ChatroomContext/ChatroomContext';
import { AgentSimulatorOptionsMenu } from '../AgentSimulatorOptionsMenu/AgentSimulatorOptionsMenu';
import { useTranslations } from '@letta-cloud/translations';
import { FlushSimulationSessionDialog } from '../FlushAgentSimulationDialog/FlushAgentSimulationDialog';

function AgentVariablesContainer() {
  const agentState = useCurrentAgent();
  const variables = useCurrentSimulatedAgentVariables();

  const t = useTranslations('ADE/AgentSimulator');

  const variableList = useMemo(() => {
    if (!getIsAgentState(agentState)) {
      return [];
    }

    return findMemoryBlockVariables(agentState);
  }, [agentState]);
  const hasVariableMismatch = useMemo(() => {
    // check if variable mismatch
    const sessionVariables = variables?.memoryVariables || {};

    // it's ok if there's more variables defined in the session than in the agent, but not the other way around
    return variableList.some((variable) => !sessionVariables[variable]);
  }, [variables, variableList]);

  const hasVariableIssue = useMemo(() => {
    return variables && hasVariableMismatch;
  }, [hasVariableMismatch, variables]);

  return (
    <AgentVariablesModal
      trigger={
        <Button
          bold
          data-testid="toggle-variables-button"
          preIcon={
            hasVariableIssue ? (
              <WarningIcon color="warning" />
            ) : (
              <VariableIcon />
            )
          }
          color="tertiary"
          label={t('showVariables')}
          size="xsmall"
        />
      }
    />
  );
}

function AgentStatus() {
  const { isTemplate, isLocal } = useCurrentAgentMetaData();
  const t = useTranslations('ADE/AgentSimulator');

  if (isTemplate) {
    return <AgentSimulatedStatusWrapper />;
  }

  if (isLocal || isTemplate) {
    // dont remove since it's used to determine layout of the header
    return <div />;
  }

  return (
    <HStack color="background">
      <Tooltip asChild content={t('liveAgentWarning.tooltip')}>
        <Badge
          border
          preIcon={<WarningIcon />}
          size="small"
          variant="warning"
          content={t('liveAgentWarning.label')}
          cursor="default"
        />
      </Tooltip>
    </HStack>
  );
}

function AgentSimulatedStatus() {
  const { simulatedAgentId } = useCurrentSimulatedAgent();
  const { agentId: templateId } = useCurrentAgentMetaData();

  if (!simulatedAgentId) {
    return <Spinner size="small" />;
  }

  return (
    <FlushSimulationSessionDialog
      simulatedAgentId={simulatedAgentId}
      templateId={templateId}
    />
  );
}

function AgentSimulatedStatusWrapper() {
  const { isTemplate } = useCurrentAgentMetaData();
  const t = useTranslations('ADE/AgentSimulator');

  if (!isTemplate) {
    return null;
  }

  return (
    <HStack
      gap={false}
      align="center"
      color="background-grey2"
      className="pointer-events-auto border border-background-grey3-border h-biHeight-sm"
    >
      <HStack
        paddingX="xsmall"
        fullHeight
        borderRight
        gap="small"
        align="center"
      >
        <Typography variant="body3" bold>
          {t('simulated.label')}
        </Typography>
        <InfoTooltip text={t('simulated.tooltip')} />
      </HStack>
      <HStack
        align="center"
        justify="center"
        className="h-biHeight-sm w-biWidth-sm"
      >
        <AgentSimulatedStatus />
      </HStack>
    </HStack>
  );
}

export function AgentSimulatorHeader() {
  return (
    <HStack
      padding="small"
      fullWidth
      align="center"
      position="absolute"
      zIndex="agentSimulatorHeader"
      justify="spaceBetween"
      color="transparent"
      className="pointer-events-none "
    >
      <div className="pointer-events-auto">
        <AgentStatus />
      </div>
      <HStack
        gap={false}
        align="center"
        color="background-grey2"
        className="pointer-events-auto border h-biHeight-sm border-background-grey3-border"
      >
        <AgentVariablesContainer />

        <HStack className="border-x border-background-grey3-border">
          <ControlChatroomRenderMode />
        </HStack>
        <AgentSimulatorOptionsMenu />
      </HStack>
    </HStack>
  );
}
