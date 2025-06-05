import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import { useAgentsServiceSummarizeAgentConversation } from '@letta-cloud/sdk-core';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
  VStack,
  Typography,
  Link,
  Alert,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgent } from '../hooks';

interface SummerizerDialogProps {
  trigger: React.ReactNode;
}

export function SummerizerDialog(props: SummerizerDialogProps) {
  const { trigger } = props;
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('SummerizerDialog');

  const agent = useCurrentAgent();

  const summarizerFormSchema = z.object({
    maxMessageLength: z
      .number()
      .int()
      .min(1, {
        message: t('errors.minLength'),
      })
      .max(1000, {
        message: t('errors.maxLength'),
      }),
  });

  type SummarizerFormValues = z.infer<typeof summarizerFormSchema>;

  const form = useForm<SummarizerFormValues>({
    resolver: zodResolver(summarizerFormSchema),
    defaultValues: {
      maxMessageLength: 5,
    },
  });

  const { mutate, isPending, error, reset } =
    useAgentsServiceSummarizeAgentConversation();

  const handleOpenChange = useCallback(
    (nextState: boolean) => {
      setOpen(nextState);
      if (!nextState) {
        form.reset();
        reset();
      }
    },
    [form, reset],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      return t('errors.default');
    }
    return '';
  }, [error, t]);

  const handleSubmit = useCallback(
    (values: SummarizerFormValues) => {
      mutate(
        {
          agentId: agent.id,
          maxMessageLength: values.maxMessageLength,
        },
        {
          onSuccess: () => {
            handleOpenChange(false);
          },
        },
      );
    },
    [mutate, agent.id, handleOpenChange],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('title')}
        errorMessage={errorMessage}
        isConfirmBusy={isPending}
        testId="summarizer-dialog"
        onOpenChange={handleOpenChange}
        trigger={trigger}
        isOpen={open}
        confirmText={t('confirmText')}
      >
        <VStack gap="form">
          <Alert variant="info" title={t('description.title')}>
            {t.rich('description.content', {
              link: (chunks) => (
                <Link
                  href="https://docs.letta.com/api-reference/agents/summarize-agent-conversation"
                  target="_blank"
                >
                  {chunks}
                </Link>
              ),
            })}
          </Alert>
          <FormField
            name="maxMessageLength"
            render={({ field }) => (
              <Input
                {...field}
                data-testid="max-message-length-input"
                fullWidth
                label={t('maxMessageLength.label')}
                description={t('maxMessageLength.description')}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value === '' ? '' : parseInt(value, 10));
                }}
              />
            )}
          />
          <Typography variant="body2" color="muted">
            {t('warning')}
          </Typography>
        </VStack>
      </Dialog>
    </FormProvider>
  );
}
