'use client';
import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../../../hooks';
import { useCallback, useState } from 'react';
import type { VariableDefinition } from '@letta-cloud/ui-component-library';
import {
  LoadingEmptyStatusComponent,
  RefreshIcon,
} from '@letta-cloud/ui-component-library';
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
        secrets: stagedVariables.map((variable) => {
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

  const handleDeleteVariable = useCallback((index: number) => {
    setStagedVariables((prev) => prev.filter((_, idx) => idx !== index));
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
    <VStack gap={false} fullWidth fullHeight color="background">
      <VStack gap="large" borderBottom padding="xlarge">
        <HStack align="center" fullWidth justify="spaceBetween">
          <Typography variant="heading5">{t('title')}</Typography>
          <HStack>
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
                preIcon={<RefreshIcon />}
                color="secondary"
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
        </HStack>
        <Alert title={t('description')} variant="brand" />
      </VStack>

      {stagedVariables.length === 0 ? (
        <VStack fullWidth fullHeight>
          <LoadingEmptyStatusComponent
            emptyAction={
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
            }
            emptyMessage={t('noVariables')}
          />
        </VStack>
      ) : (
        <VStack fullWidth>
          {stagedVariables.map((variable, index) => {
            return (
              <VStack
                borderBottom
                fullWidth
                paddingX="large"
                paddingY="medium"
                key={index}
              >
                <VariableInput
                  value={variable}
                  onValueChange={(value) => {
                    handleUpdateVariable(value, index);
                  }}
                  canDelete={true}
                  onDelete={() => {
                    handleDeleteVariable(index);
                  }}
                />
              </VStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}
