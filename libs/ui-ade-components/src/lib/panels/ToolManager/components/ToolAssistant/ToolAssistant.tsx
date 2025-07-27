import { useState, useCallback } from 'react';
import { useToolsServiceGenerateTool, type Tool } from '@letta-cloud/sdk-core';
import {
  Button,
  Dialog,
  VStack,
  HStack,
  RawTextArea,
  Typography,
  WandStarsIcon,
} from '@letta-cloud/ui-component-library';
import './ToolAssistant.scss';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import { useTranslations } from '@letta-cloud/translations';

interface ToolAssistantProps {
  tool: Tool;
}

export function ToolAssistant(props: ToolAssistantProps) {
  const { tool } = props;
  const t = useTranslations('ToolsEditor/LocalToolsViewer');
  const { stagedTool, setStagedTool } = useStagedCode(tool);
  const [useCodingAgent, setUseCodingAgent] = useState(false);
  const [promptInput, setPromptInput] = useState('');

  const {
    mutate: generateTool,
    isPending,
    isError,
  } = useToolsServiceGenerateTool({
    onSuccess: (response) => {
      if (response.tool.source_code) {
        setStagedTool((prev) => ({ ...prev, ...response.tool }));
      }
      document.dispatchEvent(
        new CustomEvent('updateLocalCode', {
          detail: { code: response.tool.source_code },
        }),
      );

      setUseCodingAgent(false);
      setPromptInput('');
    },
  });

  const handleGenerateTool = useCallback(
    (prompt: string) => {
      generateTool({
        requestBody: {
          tool_name: tool.name || '',
          starter_code: stagedTool.source_code || '',
          validation_errors: [],
          prompt: prompt,
        },
      });
    },
    [generateTool, stagedTool, tool],
  );

  return (
    <Dialog
      title={t('ToolAssistant.title')}
      onOpenChange={(open) => {
        setUseCodingAgent(open);
        if (!open) {
          setPromptInput('');
        }
      }}
      confirmText={t('ToolAssistant.generate')}
      isConfirmBusy={isPending}
      isOpen={useCodingAgent}
      errorMessage={isError ? t('ToolAssistant.error') : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (promptInput.trim() === '') return;
        handleGenerateTool(promptInput);
      }}
      trigger={
        <Button
          label={t('ToolAssistant.label')}
          color="brand"
          animate
          size="small"
          onClick={() => {
            setUseCodingAgent((prev) => !prev);
          }}
          preIcon={<WandStarsIcon />}
          _use_rarely_className="ai-tool-assistant"
        />
      }
    >
      <VStack fullWidth gap="large">
        <HStack fullWidth align="center">
          <WandStarsIcon size="xsmall" />
          <Typography variant="body3">{t('ToolAssistant.prompt')}</Typography>
        </HStack>
        <RawTextArea
          value={promptInput}
          label={t('ToolAssistant.promptLabel')}
          hideLabel
          onChange={(e) => {
            setPromptInput(e.target.value);
          }}
          placeholder={t('ToolAssistant.placeholder')}
          rows={4}
          autosize
          minRows={4}
          maxRows={10}
          fullWidth
        />
      </VStack>
    </Dialog>
  );
}
