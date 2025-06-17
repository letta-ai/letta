'use client';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Badge,
  Button,
  Code,
  Dialog,
  FunctionCall,
  HStack,
  IconAvatar,
  ImagePreview,
  SystemIcon,
  Markdown,
  PersonIcon,
  LettaInvaderIcon,
  ThoughtsIcon,
  Tooltip,
  Typography,
  VStack,
  MessageWrapper,
  LoadingEmptyStatusComponent,
  BlockQuote,
  InnerMonologueIcon,
  AnthropicLogoMarkDynamic,
  InteractiveSystemMessage,
  CaretRightIcon,
  CaretUpIcon,
} from '@letta-cloud/ui-component-library';
import type {
  AgentMessage,
  ImageContent,
  LettaUserMessageContentUnion,
  ToolReturnMessageSchemaType,
} from '@letta-cloud/sdk-core';
import { SendMessageFunctionCallSchema } from '@letta-cloud/sdk-core';
import {
  type ListMessagesResponse,
  UseAgentsServiceListMessagesKeyFn,
} from '@letta-cloud/sdk-core';
import type {
  AgentSimulatorMessageGroupType,
  AgentSimulatorMessageType,
} from '../AgentSimulator/types';
import { FunctionIcon } from '@letta-cloud/ui-component-library';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { jsonrepair } from 'jsonrepair';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useGetMessagesWorker } from './useGetMessagesWorker/useGetMessagesWorker';
import { useCurrentDevelopmentServerConfig } from '@letta-cloud/utils-client';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { DetailedMessageView } from './DetailedMessageView/DetailedMessageView';
import { cn } from '@letta-cloud/ui-styles';
import { DebugTraceSidebar } from './DebugTraceSidebar/DebugTraceSidebar';

// tryFallbackParseJson will attempt to parse a string as JSON, if it fails, it will trim the last character and try again
// until it succeeds or the string is empty
function tryFallbackParseJson(str: string): unknown {
  let trimmed = str;

  while (trimmed.length > 0) {
    try {
      return JSON.parse(jsonrepair(trimmed));
    } catch (_e) {
      trimmed = trimmed.slice(0, -1);
    }
  }

  return null;
}

function getImageSrc(imageContent: ImageContent): string | null {
  if (
    imageContent.source.type === 'base64' ||
    imageContent.source.type === 'letta'
  ) {
    const { media_type, data } = imageContent.source;
    if (!data || !media_type) return null;
    return `data:${media_type};base64,${data}`;
  }
  return null;
}

interface MessageImagePreviewProps {
  imageContent: ImageContent;
}

function MessageImagePreview({ imageContent }: MessageImagePreviewProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const src = getImageSrc(imageContent);
  const t = useTranslations('components/Messages');

  useEffect(() => {
    if (!src) {
      console.warn('Could not generate image src for:', imageContent);
    }
  }, [src, imageContent]);

  if (!src) {
    return null;
  }

  return (
    <>
      <ImagePreview
        src={src}
        alt={t('imageAltText')}
        thumbnailMaxWidth={200}
        thumbnailMaxHeight={150}
        onClick={() => {
          setIsDialogOpen(true);
        }}
        onClickDisabled={isDialogOpen}
      />
      <Dialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        size="large"
        confirmText={t('close')}
        hideCancel
        onConfirm={() => {
          setIsDialogOpen(false);
        }}
      >
        <img
          src={src}
          alt={t('imageAltText')}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
      </Dialog>
    </>
  );
}

interface ContentPartsRendererProps {
  contentParts: LettaUserMessageContentUnion[];
}

function ContentPartsRenderer({ contentParts }: ContentPartsRendererProps) {
  const parts = contentParts.reduce<Array<ImageContent[] | string>>(
    (acc, part) => {
      if (part.type === 'image') {
        const last = acc[acc.length - 1];
        if (Array.isArray(last)) {
          last.push(part);
        } else {
          acc.push([part]);
        }
      } else if (part.type === 'text') {
        acc.push(part.text);
      }
      return acc;
    },
    [],
  );

  return (
    <VStack gap="medium">
      {parts.map((item, idx) =>
        Array.isArray(item) ? (
          <HStack key={`images-${idx}`} gap="small" wrap>
            {item.map((img, i) => (
              <MessageImagePreview key={i} imageContent={img} />
            ))}
          </HStack>
        ) : (
          <Markdown key={`text-${idx}`} text={item} />
        ),
      )}
    </VStack>
  );
}

interface MessageProps {
  message: AgentSimulatorMessageType;
}

function Message({ message }: MessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const t = useTranslations('components/Messages');

  const { data: isAdvancedDebugView } = useFeatureFlag(
    'ADVANCED_MESSAGE_DEBUG',
  );

  const { data: isDetailedMessagesViewable } = useFeatureFlag(
    'DETAILED_MESSAGE_VIEW',
  );

  return (
    <VStack gap={false} fullWidth position="relative">
      {isDetailedMessagesViewable && message.stepId && (
        <div
          style={{ left: -28, top: 4 }}
          className="absolute top-0 flex flex-col gap-1 transition-all duration-500"
        >
          <Button
            preIcon={!showDetails ? <CaretRightIcon /> : <CaretUpIcon />}
            onClick={() => {
              setShowDetails((prev) => !prev);
            }}
            size="xsmall"
            hideLabel
            square
            label={showDetails ? t('details.hide') : t('details.show')}
            color="tertiary"
          />
          {isAdvancedDebugView && (
            <DebugTraceSidebar
              stepId={message.stepId}
              trigger={
                <Button
                  label={t('traceViewer')}
                  size="xsmall"
                  preIcon={<SystemIcon />}
                  hideLabel
                  square
                  color="tertiary"
                />
              }
            />
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-t-md',
          showDetails ? 'bg-background-grey border-t border-x p-2.5' : '',
        )}
      >
        {message.content}
      </div>
      {message.stepId && showDetails && (
        <DetailedMessageView stepId={message.stepId} />
      )}
    </VStack>
  );
}

interface MessageGroupType {
  group: AgentSimulatorMessageGroupType;
}

function MessageGroup({ group }: MessageGroupType) {
  const { name, messages } = group;

  const sortedMessages = messages.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const textColor = useMemo(() => {
    if (name === 'Agent') {
      return 'hsl(var(--agent-color-content))';
    }

    if (name === 'User') {
      return 'hsl(var(--user-color-content))';
    }

    return 'hsl(var(--background-grey2-content))';
  }, [name]);

  const backgroundColor = useMemo(() => {
    if (name === 'Agent') {
      return 'hsl(var(--agent-color))';
    }

    if (name === 'User') {
      return 'hsl(var(--user-color))';
    }

    return 'hsl(var(--background-grey2))';
  }, [name]);

  const icon = useMemo(() => {
    if (name === 'Agent') {
      return <LettaInvaderIcon />;
    }

    if (name === 'User') {
      return <PersonIcon />;
    }

    if (name === 'System') {
      return <SystemIcon />;
    }

    return null;
  }, [name]);

  return (
    <HStack
      paddingY="medium"
      paddingLeft="medium"
      paddingRight="xlarge"
      /* eslint-disable-next-line react/forbid-component-props */
      style={{
        backgroundColor:
          name === 'User'
            ? 'hsl(var(--user-content-background))'
            : 'hsl(var(--agent-content-background))',
      }}
      className="rounded-t-[0.75rem] rounded-br-[0.75rem]"
      data-testid="message-group"
      gap="medium"
    >
      <IconAvatar
        textColor={textColor}
        backgroundColor={backgroundColor}
        icon={icon}
        size={'xsmall'}
      />
      <VStack collapseWidth flex gap="small">
        <HStack fullWidth align="center" justify="spaceBetween">
          <Typography
            semibold
            variant="body3"
            color="lighter"
            className="tracking-[0.04em]"
          >
            {name.toUpperCase()}
          </Typography>
        </HStack>
        <VStack
          gap="large"
          data-testid={`${name.toLowerCase()}-message-content`}
        >
          {sortedMessages.map((message, index) => (
            <Message key={`${message.id}_${index}`} message={message} />
          ))}
        </VStack>
      </VStack>
    </HStack>
  );
}

const MESSAGE_LIMIT = 50;

export type MessagesDisplayMode = 'debug' | 'interactive' | 'simple';

interface MessagesProps {
  isSendingMessage: boolean;
  agentId: string;
  mode: MessagesDisplayMode;
  isPanelActive?: boolean;
  renderAgentsLink?: boolean;
}

interface LastMessageReceived {
  id: string;
  date: number;
}

export function Messages(props: MessagesProps) {
  const { isSendingMessage, renderAgentsLink, mode, isPanelActive, agentId } =
    props;

  const ref = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);
  const t = useTranslations('components/Messages');
  const [lastMessageReceived, setLastMessageReceived] =
    useState<LastMessageReceived | null>(null);

  const developmentServerConfig = useCurrentDevelopmentServerConfig();
  const { getMessages } = useGetMessagesWorker();

  const agentIdWrapper = useCallback(
    (str: string) => {
      if (CURRENT_RUNTIME === 'letta-desktop') {
        return str;
      }

      if (!renderAgentsLink) {
        return str;
      }

      const baseUrl = window.location.pathname.split('/').slice(1, 3).join('/');

      return str.replace(/agent-[a-f0-9-]{36}/g, (match) => {
        return `[${match}](/${baseUrl}/agents/${match})`;
      });
    },
    [renderAgentsLink],
  );

  const refetchInterval = useMemo(() => {
    if (isSendingMessage) {
      return false;
    }

    // last sent message was less than 10 seconds ago refetch every 500ms;

    if (lastMessageReceived && Date.now() - lastMessageReceived.date < 10000) {
      return 500;
    }

    return 5000;
  }, [isSendingMessage, lastMessageReceived]);

  const queryClient = useQueryClient();

  const { data, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery<
    AgentMessage[],
    Error,
    InfiniteData<ListMessagesResponse>,
    unknown[],
    { before?: string }
  >({
    refetchInterval,
    queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
    queryFn: async (query) => {
      const res = (await getMessages({
        url: developmentServerConfig?.url,
        headers: {
          'X-SOURCE-CLIENT': window.location.pathname,
          ...(developmentServerConfig?.password
            ? {
                Authorization: `Bearer ${developmentServerConfig.password}`,
                'X-BARE-PASSWORD': `password ${developmentServerConfig.password}`,
              }
            : {}),
        },
        agentId,
        limit: MESSAGE_LIMIT,
        ...(query.pageParam.before ? { cursor: query.pageParam.before } : {}),
      })) as unknown as AgentMessage[];

      const data = queryClient.getQueriesData<
        InfiniteData<ListMessagesResponse>
      >({
        queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
      });

      const firstPage = data[0]?.[1]?.pages[0] || [];
      const messageExistingMap = new Set<string>();

      return [
        ...(firstPage as AgentMessage[]).filter(
          (v) => v.message_type === 'user_message',
        ),
        ...(Array.isArray(res) ? res : []),
      ].filter((message) => {
        // dedupe user_message by otid or id
        if (message.message_type !== 'user_message') {
          return true;
        }

        const uid = message.otid || message.id;

        if (messageExistingMap.has(uid)) {
          return false;
        }

        messageExistingMap.add(uid);

        return true;
      });
    },
    getNextPageParam: (lastPage) => {
      if (!Array.isArray(lastPage)) {
        return undefined;
      }

      if (lastPage.length < MESSAGE_LIMIT) {
        return undefined;
      }

      return {
        before: lastPage.toSorted(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )[0].id,
      };
    },
    enabled: !isSendingMessage && !!agentId,
    initialPageParam: { before: '' },
  });

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (data.pages.length === 0) {
      return;
    }

    // most recent message is the first message in the first page
    const mostRecentMessage = data.pages[0][0];

    if (!mostRecentMessage) {
      return;
    }

    if (
      mostRecentMessage.id !== lastMessageReceived?.id &&
      'date' in mostRecentMessage
    ) {
      setLastMessageReceived({
        id: mostRecentMessage.id,
        date: new Date(mostRecentMessage.date).getTime(),
      });
    }
  }, [data?.pages, lastMessageReceived?.id]);

  const extractMessage = useCallback(
    function extractMessage(
      agentMessage: AgentMessage,
      mode: MessagesDisplayMode,
      allMessages: AgentMessage[],
    ): AgentSimulatorMessageType | null | undefined {
      if (mode === 'debug') {
        return {
          stepId: agentMessage.step_id,
          id: `${agentMessage.id}-${agentMessage.message_type}`,
          content: (
            <MessageWrapper
              type="code"
              header={{
                title: agentMessage.message_type,
              }}
            >
              <Code
                fontSize="small"
                variant="minimal"
                showLineNumbers={false}
                code={JSON.stringify(agentMessage, null, 2)}
                language="javascript"
              ></Code>
            </MessageWrapper>
          ),
          timestamp: new Date(agentMessage.date).toISOString(),
          name: agentMessage.message_type === 'user_message' ? 'User' : 'Agent',
        };
      }

      switch (agentMessage.message_type) {
        case 'system_message':
          if (mode === 'simple') {
            return null;
          }

          if (mode == 'interactive') {
            return null;
          }

          return {
            stepId: agentMessage.step_id,
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            name: 'System',
            timestamp: new Date(agentMessage.date).toISOString(),
            content: (
              <InteractiveSystemMessage
                id={agentMessage.id}
                message={agentMessage.content}
              />
            ),
          };

        case 'tool_return_message':
          if (mode === 'simple') {
            return null;
          }

          if (mode === 'interactive') {
            return null;
          }

          return {
            stepId: agentMessage.step_id,
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="code"
                header={{
                  title: t('toolReturn'),

                  badge: (
                    <Badge
                      size="small"
                      content={agentMessage.status}
                      variant={
                        agentMessage.status === 'success'
                          ? 'success'
                          : 'destructive'
                      }
                    ></Badge>
                  ),
                }}
              >
                <Code
                  fontSize="small"
                  variant="minimal"
                  showLineNumbers={false}
                  code={JSON.stringify(
                    {
                      ...agentMessage,
                      tool_return: tryFallbackParseJson(
                        agentMessage.tool_return,
                      ),
                    },
                    null,
                    2,
                  )}
                  language="javascript"
                ></Code>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
          };
        case 'tool_call_message': {
          const parsedFunctionCallArguments = tryFallbackParseJson(
            agentMessage.tool_call.arguments || '',
          );

          if (mode === 'simple' || mode === 'interactive') {
            if (!agentMessage.tool_call.name) {
              return null;
            }

            if (
              'send_message'.includes(agentMessage.tool_call.name) &&
              agentMessage.tool_call.arguments
            ) {
              try {
                const out = SendMessageFunctionCallSchema.safeParse(
                  tryFallbackParseJson(agentMessage.tool_call.arguments || ''),
                );

                if (!out.success) {
                  throw new Error('Unable to parse message');
                }

                return {
                  stepId: agentMessage.step_id,
                  id: `${agentMessage.id}-${agentMessage.message_type}`,
                  content: (
                    <VStack>
                      <Markdown text={agentIdWrapper(out.data.message)} />
                    </VStack>
                  ),
                  name: 'Agent',
                  timestamp: new Date(agentMessage.date).toISOString(),
                };
              } catch (_e) {
                return {
                  stepId: agentMessage.step_id,
                  id: `${agentMessage.id}-${agentMessage.message_type}`,
                  content: '',
                  timestamp: new Date(agentMessage.date).toISOString(),
                  name: 'Agent',
                };
              }
            }

            if (mode === 'interactive') {
              const functionResponse = allMessages.find(
                (message) =>
                  message.message_type === 'tool_return_message' &&
                  get(message, 'tool_call_id') ===
                    agentMessage.tool_call.tool_call_id,
              );
              return {
                stepId: agentMessage.step_id,
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: (
                  <FunctionCall
                    id={`${agentMessage.id}-${agentMessage.message_type}`}
                    key={`${agentMessage.id}-${agentMessage.message_type}`}
                    name={agentMessage.tool_call.name || ''}
                    inputs={agentMessage.tool_call.arguments || ''}
                    response={functionResponse as ToolReturnMessageSchemaType}
                    status={get(functionResponse, 'status')}
                  />
                ),
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'Agent',
              };
            }

            return null;
          }

          return {
            stepId: agentMessage.step_id,
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="code"
                header={{
                  title: agentMessage.tool_call.name || '',
                  preIcon: <FunctionIcon />,
                }}
              >
                <Code
                  fontSize="small"
                  variant="minimal"
                  showLineNumbers={false}
                  code={JSON.stringify(
                    {
                      ...agentMessage.tool_call,
                      arguments:
                        parsedFunctionCallArguments ||
                        agentMessage.tool_call.arguments,
                    },
                    null,
                    2,
                  )}
                  language="javascript"
                ></Code>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
          };
        }
        case 'reasoning_message':
          if (mode === 'simple') {
            return null;
          }

          if (mode === 'interactive') {
            return {
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: (
                <BlockQuote fullWidth>
                  <VStack gap="small">
                    <HStack align="center" justify="spaceBetween">
                      <HStack align="center" gap="small">
                        <InnerMonologueIcon color="violet" size="small" />
                        <Typography bold color="violet" variant="body2">
                          {t('reasoning')}
                        </Typography>
                      </HStack>
                      {agentMessage.source === 'reasoner_model' && (
                        <div className="pr-8">
                          <Tooltip content={t('reasonerModel')}>
                            <AnthropicLogoMarkDynamic
                              color="violet"
                              size="small"
                              className="opacity-60"
                            />
                          </Tooltip>
                        </div>
                      )}
                    </HStack>
                    <Typography color="lighter">
                      {agentMessage.reasoning}
                    </Typography>
                  </VStack>
                </BlockQuote>
              ),
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'Agent',
            };
          }

          return {
            stepId: agentMessage.step_id,
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="reasoningMessage"
                header={{
                  preIcon: <ThoughtsIcon />,
                  title: t('reasoningMessage'),
                }}
              >
                <Typography>{agentMessage.reasoning}</Typography>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
          };
        case 'hidden_reasoning_message':
          if (mode === 'simple') {
            return null;
          }
          if (mode === 'interactive') {
            return {
              stepId: agentMessage.step_id,
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: (
                <BlockQuote fullWidth>
                  <VStack gap="small">
                    <HStack align="center" justify="spaceBetween">
                      <HStack align="center" gap="small">
                        <InnerMonologueIcon color="violet" size="small" />
                        <Typography bold color="violet" variant="body2">
                          {t('reasoning')}
                        </Typography>
                      </HStack>
                      <div className="pr-8">
                        <Tooltip content={t('reasonerModel')}>
                          <AnthropicLogoMarkDynamic
                            color="violet"
                            size="small"
                            className="opacity-60"
                          />
                        </Tooltip>
                      </div>
                    </HStack>
                    <Typography
                      semibold
                      uppercase
                      variant="body3"
                      color="muted"
                    >
                      {agentMessage.state + ' by model provider'}
                    </Typography>
                  </VStack>
                </BlockQuote>
              ),
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'Agent',
            };
          }

          return {
            stepId: agentMessage.step_id,
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            content: (
              <MessageWrapper
                type="reasoningMessage"
                header={{
                  preIcon: <ThoughtsIcon />,
                  title: t('reasoningMessage'),
                }}
              >
                <Typography>
                  {agentMessage.state + ' by model provider'}
                </Typography>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
          };
        case 'user_message': {
          const content = agentMessage.content as
            | LettaUserMessageContentUnion[]
            | string;
          if (Array.isArray(content)) {
            if (mode === 'simple' || mode === 'interactive') {
              return {
                stepId: agentMessage.step_id,
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: <ContentPartsRenderer contentParts={content} />,
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'User',
              };
            }
          } else {
            let isContentJson = false;
            try {
              JSON.parse(content);
              isContentJson = true;
            } catch {
              isContentJson = false;
            }

            if (mode === 'simple' || mode === 'interactive') {
              if (isContentJson) {
                return null;
              }

              return {
                stepId: agentMessage.step_id,
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: (
                  <VStack>
                    <Markdown text={agentIdWrapper(content)} />
                  </VStack>
                ),
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'User',
              };
            }

            if (isContentJson) {
              const tryParseResp = tryFallbackParseJson(content);

              if (tryParseResp) {
                return {
                  stepId: agentMessage.step_id,
                  id: `${agentMessage.id}-${agentMessage.message_type}`,
                  content: (
                    <MessageWrapper
                      type="code"
                      header={{
                        title: t('hiddenUserMessage'),
                      }}
                    >
                      <Code
                        fontSize="small"
                        variant="minimal"
                        showLineNumbers={false}
                        code={JSON.stringify(tryParseResp, null, 2)}
                        language="javascript"
                      ></Code>
                    </MessageWrapper>
                  ),
                  timestamp: new Date(agentMessage.date).toISOString(),
                  name: 'User',
                };
              }

              return {
                stepId: agentMessage.step_id,
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: <Typography>{content}</Typography>,
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'User',
              };
            }

            return {
              stepId: agentMessage.step_id,
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: <Typography>{content}</Typography>,
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'User',
            };
          }
        }
      }
    },
    [t, agentIdWrapper],
  );

  const messageGroups = useMemo(() => {
    if (!data) {
      return [];
    }

    const firstPage = Array.isArray(data.pages[0]) ? data.pages[0] : [];
    const messageExistingMap = new Set<string>();

    const preMessages = [...firstPage, ...(data.pages.slice(1).flat() || [])]
      .filter((message) => {
        if (!message.otid) {
          return true;
        }

        if (messageExistingMap.has(message.otid)) {
          return false;
        }

        messageExistingMap.add(message.otid);

        return true;
      })
      .map((message, _, allMessages) =>
        // @ts-expect-error - the typing is wrong
        extractMessage(message, mode, allMessages),
      )
      .filter((message) => !!message)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    // group messages by name

    const groupedMessages: AgentSimulatorMessageGroupType[] = [];

    preMessages.forEach((message, index) => {
      const lastGroup = groupedMessages[groupedMessages.length - 1];
      const nextMessage = {
        id: message.id || '',
        content: message.content || '',
        name: message.name,
        stepId: message.stepId || '',
        timestamp: message.timestamp || '',
      };

      if (index !== 0 && lastGroup.name === message.name) {
        lastGroup.messages.push(nextMessage);
      } else {
        groupedMessages.push({
          id: message.id || '1',
          name: message.name,
          messages: [nextMessage],
        });
      }
    });

    return groupedMessages;
  }, [extractMessage, mode, data]);

  useEffect(() => {
    if (ref.current) {
      if (messageGroups.length > 0) {
        setTimeout(() => {
          if (!ref.current) {
            return;
          }

          if (!hasScrolledInitially.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
            hasScrolledInitially.current = true;
          }
        }, 10);
      }

      if (isSendingMessage) {
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    }
  }, [messageGroups, isPanelActive, isSendingMessage]);

  const lastMessageRefId = useRef<string | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (
      lastMessageRefId.current === messageGroups[messageGroups.length - 1]?.id
    ) {
      return;
    }

    lastMessageRefId.current = messageGroups[messageGroups.length - 1]?.id;

    // scroll down if new messages are received, and the user is within 300px of the bottom
    const boundary = 300;

    const bottom =
      ref.current.scrollHeight - ref.current.clientHeight - boundary;

    if (ref.current.scrollTop >= bottom || isSendingMessage) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [messageGroups, isSendingMessage]);

  return (
    <VStack
      data-testid="messages-list"
      ref={ref}
      fullWidth
      collapseHeight
      overflowY="auto"
      gap="large"
      padding="small"
    >
      {hasNextPage && (
        <Button
          busy={isFetching}
          onClick={() => {
            void fetchNextPage();
          }}
          fullWidth
          color="secondary"
          label="Load more"
        />
      )}
      {messageGroups.map((group) => (
        <MessageGroup key={group.id} group={group} />
      ))}
      {hasNextPage && messageGroups.length === 0 && mode === 'simple' && (
        <Alert variant="info" title={t('noParsableMessages')} />
      )}
      {data &&
        !hasNextPage &&
        messageGroups.length === 0 &&
        mode !== 'simple' && (
          <LoadingEmptyStatusComponent
            loaderVariant="spinner"
            emptyMessage={t('noMessages')}
          />
        )}
      {!data && (
        <LoadingEmptyStatusComponent
          isLoading
          loadingMessage={t('loadingMessages')}
          loaderVariant="spinner"
        />
      )}
    </VStack>
  );
}
