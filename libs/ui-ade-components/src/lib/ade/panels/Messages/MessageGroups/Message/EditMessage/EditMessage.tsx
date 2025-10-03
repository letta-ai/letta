import {
  Badge,
  Button,
  FormField,
  FormProvider,
  HStack,
  Tooltip,
  Typography,
  useForm,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import {
  type LettaMessageUnion,
  type ListMessagesResponse,
  UseAgentsServiceListMessagesKeyFn,
  useAgentsServiceModifyMessage,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useCurrentSimulatedAgent } from '../../../../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useRawMessageContent } from '../../../hooks/useRawMessageContent/useRawMessageContent';

interface EditMessageProps {
  message: LettaMessageUnion;
  onSuccess: (updatedMessage: LettaMessageUnion) => void;
  onClose: VoidFunction;
}

export function EditMessage(props: EditMessageProps) {
  const { message, onClose, onSuccess } = props;

  const { id: agentId } = useCurrentSimulatedAgent();

  const t = useTranslations('ADE/AgentSimulator/EditMessage');

  const EditMessageSchema = z.object({
    text: z.string().min(1, t('errors.noContent')),
  });

  type EditMessageType = z.infer<typeof EditMessageSchema>;


  const raw = useRawMessageContent(message);

  const form = useForm<EditMessageType>({
    resolver: zodResolver(EditMessageSchema),
    defaultValues: {
      text: raw || '',
    },
  });

  const queryClient = useQueryClient();

  const { mutate, isPending } = useAgentsServiceModifyMessage({
    onError: () => {
      form.setError('text', {
        message: t('errors.unknown'),
      });
    },
  });

  const onSubmit = useCallback(
    (submitData: EditMessageType) => {
      switch (message.message_type) {
        case 'tool_call_message': {
          mutate(
            {
              agentId,
              messageId: message.id,
              requestBody: {
                message_type: 'assistant_message',
                content: submitData.text,
              },
            },
            {
              onSuccess: () => {
                const updatedMessage: LettaMessageUnion = {
                  ...message,
                  tool_call: {
                    ...message.tool_call,
                    arguments: JSON.stringify({
                      message: submitData.text,
                      request_heartbeat: false,
                    }),
                  },
                };

                queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
                  {
                    queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
                  },
                  (data) => {
                    if (!data) {
                      return data;
                    }

                    return {
                      ...data,
                      pages: data.pages.map((page) => {
                        const messages = page as LettaMessageUnion[];

                        return messages.map((m) => {
                          if (
                            m.message_type === 'tool_call_message' &&
                            m.tool_call.tool_call_id === message.tool_call.tool_call_id
                          ) {
                            return updatedMessage;
                          }
                          return m;
                        });
                      }),
                    };
                  },
                );

                onSuccess(updatedMessage);
              },
            },
          );

          break;
        }
        case 'reasoning_message': {
          mutate(
            {
              agentId,
              messageId: message.id || '',
              requestBody: {
                message_type: 'reasoning_message',
                reasoning: submitData.text,
              },
            },
            {
              onSuccess: () => {
                const updatedMessage: LettaMessageUnion = {
                  ...message,
                  reasoning: submitData.text,
                };

                queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
                  {
                    queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
                  },
                  (data) => {
                    if (!data) {
                      return data;
                    }

                    return {
                      ...data,
                      pages: data.pages.map((page) => {
                        const messages = page as LettaMessageUnion[];

                        return messages.map((m) => {
                          if (
                            m.id === message.id &&
                            message.message_type === 'reasoning_message'
                          ) {
                            return updatedMessage;
                          }
                          return m;
                        });
                      }),
                    };
                  },
                );

                onSuccess(updatedMessage);
              },
            },
          );

          break;
        }
        case 'user_message': {
          mutate(
            {
              agentId,
              messageId: message.id || '',
              requestBody: {
                message_type: 'user_message',
                content: submitData.text,
              },
            },
            {
              onSuccess: () => {
                const updatedMessage: LettaMessageUnion = {
                  ...message,
                  content: submitData.text,
                };

                queryClient.setQueriesData<InfiniteData<ListMessagesResponse>>(
                  {
                    queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
                  },
                  (data) => {
                    if (!data) {
                      return data;
                    }

                    return {
                      ...data,
                      pages: data.pages.map((page) => {
                        const messages = page as LettaMessageUnion[];

                        return messages.map((m) => {
                          if (
                            m.id === message.id &&
                            message.message_type === 'user_message'
                          ) {
                            return updatedMessage;
                          }
                          return m;
                        });
                      }),
                    };
                  },
                );

                onSuccess(updatedMessage);
              },
            },
          );

          break;
        }
      }
    },
    [
      agentId,
      message,
      mutate,
      onSuccess,
      queryClient,
    ],
  );

  const error = form.formState.errors.text;

  if (!raw) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          name="text"
          render={({ field }) => (
            <VStack border padding="small" fullWidth color="background">
              <TextareaAutosize
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                }}
                className="w-full focus:outline-none text-sm resize-none bg-transparent text-text"
                placeholder={t('placeholder')}
                autoFocus
              />
              <HStack justify="spaceBetween">
                <HStack>
                  {error?.message ? (
                    <Typography variant="body3" color="destructive">
                      {error?.message}
                    </Typography>
                  ) : (
                    <Tooltip content={t('tooltip')}>
                      <Badge
                        preIcon={<WarningIcon />}
                        content={t('disclaimer')}
                        variant="warning"
                        size="small"
                      />
                    </Tooltip>
                  )}
                </HStack>
                <HStack>
                  <Button
                    label={t('cancel')}
                    type="button"
                    onClick={onClose}
                    size="small"
                    color="tertiary"
                  />
                  <Button
                    busy={isPending}
                    label={t('save')}
                    type="submit"
                    size="small"
                    color="primary"
                  />
                </HStack>
              </HStack>
            </VStack>
          )}
        />
      </form>
    </FormProvider>
  );
}
