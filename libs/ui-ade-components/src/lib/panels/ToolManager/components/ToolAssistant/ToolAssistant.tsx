import { useState, useCallback } from 'react';
import { useToolsServiceGenerateTool, type Tool } from '@letta-cloud/sdk-core';
import {
  Button,
  VStack,
  HStack,
  Typography,
  WandStarsIcon,
  Popover,
  Alert,
  Badge,
  Form,
  FormField,
  TextArea,
  useForm,
  FormProvider,
} from '@letta-cloud/ui-component-library';
import './ToolAssistant.scss';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import { useToolValidation } from '../../hooks/useToolValidation/useToolValidation';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface ToolAssistantProps {
  tool: Tool;
}

export function ToolAssistant(props: ToolAssistantProps) {
  const { tool } = props;
  const t = useTranslations('ToolsEditor/LocalToolsViewer');
  const { stagedTool, setStagedTool } = useStagedCode(tool);
  const { validationErrors } = useToolValidation(stagedTool.source_code || '');
  const [isCodingAgentOpen, setIsCodingAgentOpen] = useState(false);

  const {
    mutate: generateTool,
    reset,
    isPending,
    isError,
  } = useToolsServiceGenerateTool({
    onSuccess: (response) => {
      if (response.tool.source_code) {
        setStagedTool((prev) => ({ ...prev, ...response.tool }));
        document.dispatchEvent(
          new CustomEvent('updateLocalCode', {
            detail: { code: response.tool.source_code },
          }),
        );
      }

      if (response.tool.json_schema) {
        document.dispatchEvent(
          new CustomEvent('updateJsonSchema', {
            detail: { schema: response.tool.json_schema },
          }),
        );
      }

      setIsCodingAgentOpen(false);
    },
  });

  const formSchema = z.object({
    prompt: z.string().min(1, t('ToolAssistant.promptRequired')),
  });

  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  const handleGenerateTool = useCallback(
    (prompt: string) => {
      generateTool({
        requestBody: {
          tool_name: tool.name || '',
          starter_code: stagedTool.source_code || '',
          validation_errors: validationErrors.map(
            (error) => `Line ${error.line}: ${error.message}`,
          ),
          prompt: prompt.trim(),
        },
      });
    },
    [generateTool, stagedTool, tool, validationErrors],
  );

  return (
    <Popover
      align="start"
      onOpenChange={(open) => {
        setIsCodingAgentOpen(open);
        if (!open) {
          form.reset();
          reset();
        }
      }}
      open={isCodingAgentOpen}
      className="w-[400px] rounded-sm shadow-sm"
      triggerAsChild
      trigger={
        <Button
          color="secondary"
          label={t('ToolAssistant.label')}
          size="small"
          preIcon={<WandStarsIcon />}
        />
      }
    >
      <FormProvider {...form}>
        <Form
          onSubmit={form.handleSubmit((data) => {
            handleGenerateTool(data.prompt);
          })}
        >
          <VStack color="background" padding fullWidth gap="large">
            {isError && <Alert title={t('ToolAssistant.error')} />}
            <HStack>
              <HStack fullWidth align="center">
                <WandStarsIcon size="small" />
                <Typography bold variant="body3">
                  {t('ToolAssistant.prompt')}
                </Typography>
              </HStack>
              <Badge size="small" variant="warning" content="BETA" />
            </HStack>
            <FormField
              render={({ field }) => (
                <TextArea
                  {...field}
                  label={t('ToolAssistant.promptLabel')}
                  hideLabel
                  disabled={isPending}
                  placeholder={t('ToolAssistant.placeholder')}
                  rows={4}
                  autosize
                  minRows={4}
                  maxRows={10}
                  fullWidth
                />
              )}
              name="prompt"
            />
            <HStack fullWidth justify="end">
              <Button
                type="submit"
                color="secondary"
                label={t('ToolAssistant.generate')}
                size="small"
                busy={isPending}
              />
            </HStack>
          </VStack>
        </Form>
      </FormProvider>
    </Popover>
  );
}
