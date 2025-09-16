import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useEffect } from 'react';
import {
  Alert,
  Button,
  Form,
  RawInput,
  VStack,
} from '@letta-cloud/ui-component-library';
import { DeleteToolButton } from '../DeleteToolButton/DeleteToolButton';
import type { Tool } from '@letta-cloud/sdk-core';
import {
  UseToolsServiceListToolsKeyFn,
  useToolsServiceModifyTool,
  UseToolsServiceRetrieveToolKeyFn,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@letta-cloud/ui-component-library';

interface ToolSettingsProps {
  showDelete?: boolean;
  showSave?: boolean;
  tool: Tool;
}

export function ToolSettings(props: ToolSettingsProps) {
  const { showDelete = true, tool, showSave = false } = props;
  const { stagedTool, setStagedTool } = useStagedCode(tool);

  const t = useTranslations('ToolsEditor/ToolSettings');
  const queryClient = useQueryClient();
  const handleReturnCharLimitChange = useCallback(
    (value: string) => {
      setStagedTool((prev) => ({
        ...prev,
        // @ts-expect-error - we want to do a hacky cast here because we can throw an error if the value is not a number
        return_char_limit: value as number,
      }));
    },
    [setStagedTool],
  );

  const { isPending, mutate, isError, isSuccess } = useToolsServiceModifyTool({
    onSuccess: (response) => {
      queryClient.setQueriesData<Tool[] | undefined>(
        {
          queryKey: UseToolsServiceListToolsKeyFn(),
          exact: false,
        },
        (old) => {
          if (!old) {
            return old;
          }

          return old.map((t) => {
            if (t.id === tool.id) {
              return response;
            }

            return t;
          });
        },
      );

      queryClient.setQueriesData<Tool | undefined>(
        {
          queryKey: UseToolsServiceRetrieveToolKeyFn({ toolId: tool.id || '' }),
        },
        () => response,
      );

      setStagedTool(() => response);
    },
  });

  const handleSaveTool = useCallback(() => {
    if (!stagedTool.id) {
      return;
    }

    mutate({
      toolId: stagedTool.id,
      requestBody: {
        return_char_limit: Number(stagedTool.return_char_limit),
      },
    });
  }, [stagedTool.id, stagedTool.return_char_limit, mutate]);

  useEffect(() => {
    if (isSuccess) {
      toast.success(t('returnCharacterLimit.update'));
    }
  }, [isSuccess, t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the tool manager window from closing when the user taps 'enter'
    handleSaveTool();
  };

  return (
    <VStack padding fullWidth fullHeight gap="large">
      <Form variant="dashboard" onSubmit={handleSubmit}>
        <RawInput
          label={t('returnCharLimit.label')}
          value={stagedTool.return_char_limit}
          onChange={(e) => {
            handleReturnCharLimitChange(e.target.value);
          }}
          type="number"
          fullWidth
        />
        {showSave && (
          <div>
            <Button
              label={t('save')}
              busy={isPending}
              onClick={handleSaveTool}
            />
          </div>
        )}
        {isError && <Alert title={t('error')} variant="destructive" />}
      </Form>
      {showDelete && (
        <div>
          <DeleteToolButton currentToolId={tool.id || ''} />
        </div>
      )}
    </VStack>
  );
}
