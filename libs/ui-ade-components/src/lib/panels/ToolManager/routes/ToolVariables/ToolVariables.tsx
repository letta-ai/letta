import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../../hooks';
import { useCallback, useState } from 'react';
import type { VariableDefinition } from '@letta-cloud/ui-component-library';
import {
  Button,
  HStack,
  PlusIcon,
  Typography,
} from '@letta-cloud/ui-component-library';
import { Alert } from '@letta-cloud/ui-component-library';
import { VariableInput, VStack } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { AgentState } from '@letta-cloud/sdk-core';

export function ToolVariables() {
  const { tool_exec_environment_variables = [] } = useCurrentAgent();

  const handleTransformVariables = useCallback(
    (variables: AgentState['tool_exec_environment_variables']) => {
      if (!variables) {
        return [];
      }

      return variables.map((variable) => {
        return {
          key: variable.key,
          value: variable.value,
          scope: 'agent' as const,
        };
      });
    },
    [],
  );

  const [stagedVariables, setStagedVariables] = useState<VariableDefinition[]>(
    () => {
      return handleTransformVariables(tool_exec_environment_variables);
    },
  );

  const { syncUpdateCurrentAgent, isUpdating, isDebouncing } =
    useSyncUpdateCurrentAgent();
  const { id: agentId } = useCurrentAgent();
  const handleUpdateAgent = useCallback(() => {
    syncUpdateCurrentAgent((prev) => {
      return {
        ...prev,
        tool_exec_environment_variables: stagedVariables.map((variable) => {
          return {
            agent_id: agentId,
            key: variable.key,
            value: variable.value,
          };
        }),
      };
    });
  }, [stagedVariables, syncUpdateCurrentAgent, agentId]);

  const handleAddVariable = useCallback((variable: VariableDefinition) => {
    setStagedVariables((prev) => [...prev, variable]);
  }, []);

  const t = useTranslations('ToolManager/ToolVariables');

  const handleResetVariables = useCallback(() => {
    setStagedVariables(
      handleTransformVariables(tool_exec_environment_variables),
    );
  }, [handleTransformVariables, tool_exec_environment_variables]);

  const handleDeleteVariable = useCallback((variable: VariableDefinition) => {
    setStagedVariables((prev) =>
      prev.filter((item) => item.key !== variable.key),
    );
  }, []);

  const handleUpdateVariable = useCallback(
    (variable: VariableDefinition, index: number) => {
      setStagedVariables((prev) => {
        return prev.map((item, i) => {
          if (i === index) {
            return variable;
          }
          return item;
        });
      });
    },
    [],
  );

  return (
    <VStack fullWidth fullHeight color="background-grey" align="center" padding>
      <VStack
        overflowY="auto"
        color="background"
        fullHeight
        border
        width="largeContained"
        fullWidth
        padding
      >
        <HStack fullWidth justify="spaceBetween">
          <Typography variant="heading5">{t('title')}</Typography>
        </HStack>
        <Alert title={t('description')} variant="brand" />

        <VStack fullWidth>
          {stagedVariables.map((variable, index) => {
            return (
              <VariableInput
                key={index}
                value={variable}
                onValueChange={(value) => {
                  handleUpdateVariable(value, index);
                }}
                canDelete={true}
                onDelete={() => {
                  handleDeleteVariable(variable);
                }}
              />
            );
          })}
        </VStack>
        <HStack fullWidth justify="spaceBetween">
          <Button
            label={t('addVariable')}
            onClick={() => {
              handleAddVariable({
                key: '',
                value: '',
                scope: 'agent',
              });
            }}
            color="secondary"
            preIcon={<PlusIcon />}
          />
          <HStack>
            <Button
              label={t('reset')}
              onClick={handleResetVariables}
              color="tertiary"
              disabled={isUpdating || isDebouncing}
            />
            <Button
              label={t('save')}
              busy={isUpdating || isDebouncing}
              onClick={handleUpdateAgent}
              color="primary"
            />
          </HStack>
        </HStack>
      </VStack>
    </VStack>
  );
}
