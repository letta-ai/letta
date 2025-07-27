import {
  Badge,
  Button,
  HStack,
  Tooltip,
  VariableIcon,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { AgentVariablesModal } from '../AgentVariablesModal/AgentVariablesModal';
import React, { useMemo } from 'react';
import { useCurrentSimulatedAgent } from '../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { getIsAgentState } from '@letta-cloud/sdk-core';
import { findMemoryBlockVariables } from '@letta-cloud/utils-shared';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../hooks';
import { ControlChatroomRenderMode } from '../ChatroomContext/ChatroomContext';
import { AgentSimulatorOptionsMenu } from '../AgentSimulatorOptionsMenu/AgentSimulatorOptionsMenu';
import { FlushSimulationSessionDialog } from '../FlushAgentSimulationDialog/FlushAgentSimulationDialog';
import { useTranslations } from '@letta-cloud/translations';

function AgentVariablesContainer() {
  const agentState = useCurrentAgent();

  const { agentSession } = useCurrentSimulatedAgent();
  const t = useTranslations('ADE/AgentSimulator');

  const variableList = useMemo(() => {
    if (!getIsAgentState(agentState)) {
      return [];
    }

    return findMemoryBlockVariables(agentState);
  }, [agentState]);
  const hasVariableMismatch = useMemo(() => {
    // check if variable mismatch
    const sessionVariables = agentSession?.body.memoryVariables || {};

    // it's ok if there's more variables defined in the session than in the agent, but not the other way around
    return variableList.some((variable) => !sessionVariables[variable]);
  }, [agentSession?.body.memoryVariables, variableList]);

  const hasVariableIssue = useMemo(() => {
    return hasVariableMismatch;
  }, [hasVariableMismatch]);

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
        />
      </Tooltip>
    </HStack>
  );
}

function AgentFlushButton() {
  const { isTemplate } = useCurrentAgentMetaData();
  const { agentSession } = useCurrentSimulatedAgent();

  if (!(isTemplate && agentSession?.body.agentId)) {
    return null;
  }

  return <FlushSimulationSessionDialog />;
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
      className="pointer-events-none"
    >
      <div className="pointer-events-auto">
        <AgentStatus />
      </div>
      <HStack
        border
        gap={false}
        align="center"
        color="background-grey2"
        className="pointer-events-auto"
      >
        <AgentVariablesContainer />

        <HStack borderX>
          <ControlChatroomRenderMode />
        </HStack>
        <AgentFlushButton />
        <AgentSimulatorOptionsMenu />
      </HStack>
    </HStack>
  );
}
