'use client';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  EditIcon,
  CircleIcon,
  SmallInvaderOutlineIcon,
  JSONViewer,
  Spinner,
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
import { get, isObject } from 'lodash-es';
import { useGetMessagesWorker } from './useGetMessagesWorker/useGetMessagesWorker';
import { useCurrentDevelopmentServerConfig } from '@letta-cloud/utils-client';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { cn } from '@letta-cloud/ui-styles';
import { DebugTraceSidebar } from './DebugTraceSidebar/DebugTraceSidebar';
import './Messages.scss';
import { StepDetailBar } from './StepDetailBar/StepDetailBar';
import { EditMessage } from './EditMessage/EditMessage';
import { useADEAppContext } from '../../AppContext/AppContext';
import { SelectDatasetPopover } from './Popover/SelectDatasetPopover';
import { usePrependMessages } from './hooks/usePrependMessages';
import { useScrollHandler } from './hooks/useScrollHandler';

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
        disabled={isDialogOpen}
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

interface MessageContentProps {
  message: AgentSimulatorMessageType;
  showEdit: boolean;
  setShowEdit: (show: boolean) => void;
  disableInteractivity?: boolean;
}

function MessageContent({ message, showEdit, setShowEdit, disableInteractivity }: MessageContentProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { projectId } = useADEAppContext();
  const { data: isDatasetsEnabled } = useFeatureFlag('DATASETS');
  const t = useTranslations('components/Messages');

  if (showEdit) {
    return (
      <EditMessage
        onClose={() => {
          setShowEdit(false);
        }}
        onSuccess={() => {
          setShowEdit(false);
        }}
        message={message}
      />
    );
  }

  // Special handling for reasoning messages to place edit button inline with text
  if (message.type === 'reasoning_message' && message.raw) {
    return (
      <BlockQuote fullWidth>
        <VStack gap="small">
          <HStack align="center" gap="small">
            <InnerMonologueIcon color="violet" size="small" />
            <Typography semibold color="violet" variant="body3">
              {t('reasoning')}
            </Typography>
          </HStack>
          <HStack justify="spaceBetween" align="start">
            <Typography color="lighter" variant="body3" className="flex-1">
              {message.raw}
            </Typography>
            {message.editId && !disableInteractivity && (
              <Button
                preIcon={<EditIcon size="auto" />}
                onClick={() => {
                  setShowEdit(!showEdit);
                }}
                size="3xsmall"
                hideLabel
                square
                active={showEdit}
                _use_rarely_className="w-4 min-h-4 messages-step-editor text-muted hover:text-brand hover:bg-transparent"
                label={showEdit ? t('edit.stop') : t('edit.start')}
                color="tertiary"
              />
            )}
          </HStack>
        </VStack>
      </BlockQuote>
    );
  }

  // Default handling for other message types
  return (
    <HStack justify="spaceBetween" align="start">
      <div
        className="w-full"
        style={{
          textDecoration: message.isError
            ? 'underline wavy hsl(var(--destructive))'
            : 'none',
          textUnderlineOffset: '2px',
        }}
      >
        {message.content}
      </div>

      {isDatasetsEnabled && message.name === 'User' && (
        <SelectDatasetPopover
          message={message}
          projectId={projectId}
          isOpen={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
        />
      )}
      {message.editId && !disableInteractivity && (
        <Button
          preIcon={<EditIcon size="auto" />}
          onClick={() => {
            setShowEdit(!showEdit);
          }}
          size="3xsmall"
          hideLabel
          square
          active={showEdit}
          _use_rarely_className="w-4 min-h-4 messages-step-editor text-muted hover:text-brand hover:bg-transparent"
          label={showEdit ? t('edit.stop') : t('edit.start')}
          color="tertiary"
        />
      )}
    </HStack>
  );
}

interface MessageProps {
  message: AgentSimulatorMessageType;
  disableInteractivity?: boolean;
}

function Message({ message, disableInteractivity }: MessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);


  return (
    <VStack gap={false} fullWidth>
      <div
        className={cn(
          'w-full rounded-t-md messages-step border border-transparent',
          showDetails
            ? 'bg-background-grey message-step-selected border-border border-t border-x p-2.5  pb-1'
            : '',
        )}
      >
        <MessageContent
          message={message}
          showEdit={showEdit}
          setShowEdit={setShowEdit}
          disableInteractivity={disableInteractivity}
        />
        {!disableInteractivity && (
          <StepDetailBar
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            message={message}
          />
        )}
      </div>
    </VStack>
  );
}

interface MessageGroupType {
  group: AgentSimulatorMessageGroupType;
  dataAnchor?: string;
  disableInteractivity?: boolean;
}

function MessageGroup({ group, dataAnchor, disableInteractivity }: MessageGroupType) {
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
      return <SmallInvaderOutlineIcon size="xsmall" />;
    }

    if (name === 'User') {
      return <PersonIcon />;
    }

    if (name === 'System') {
      return <SystemIcon />;
    }

    return null;
  }, [name]);

  const t = useTranslations('components/Messages');

  const firstMessageWithStepId = useMemo(() => {
    return messages.find((message) => !!message.stepId);
  }, [messages]);

  return (
    <VStack
      paddingY="medium"
      paddingLeft="medium"
      position="relative"
      paddingRight="medium"
      /* eslint-disable-next-line react/forbid-component-props */
      style={{
        backgroundColor:
          name === 'User'
            ? 'hsl(var(--user-content-background))'
            : 'hsl(var(--agent-content-background))',
      }}
      className="rounded-t-[0.375rem] gap-1.5 rounded-br-[0.375rem] w-full"
      data-testid="message-group"
      {...(dataAnchor && { 'data-anchor': dataAnchor })}
    >
      {firstMessageWithStepId?.stepId && (
        <div className="absolute right-[7px] top-[7px]">
          <DebugTraceSidebar
            stepId={firstMessageWithStepId.stepId}
            trigger={
              <Button
                label={t('traceViewer')}
                size="3xsmall"
                preIcon={<CircleIcon color="muted" size="auto" />}
                hideLabel
                square
                color="tertiary"
              />
            }
          />
        </div>
      )}

      <HStack align="center" className="gap-1.5">
        <IconAvatar
          textColor={textColor}
          backgroundColor={backgroundColor}
          icon={icon}
          size={'xxsmall'}
          className="rounded-[2px]"
        />
        <Typography variant="body4" className="tracking-[0.04em] font-bold">
          {name.toUpperCase()}
        </Typography>
      </HStack>
      <VStack
        gap="medium"
        data-testid={`${name.toLowerCase()}-message-content`}
      >
        {sortedMessages.map((message, index) => (
          <Message
            disableInteractivity={disableInteractivity}
            key={`${message.id}_${index}`} message={message} />
        ))}
      </VStack>
    </VStack>
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
  injectSpaceForHeader?: boolean;
  disableInteractivity?: boolean;
}

interface LastMessageReceived {
  id: string;
  date: number;
}

export function Messages(props: MessagesProps) {
  const {
    disableInteractivity,
    isSendingMessage,
    injectSpaceForHeader,
    renderAgentsLink,
    mode,
    isPanelActive,
    agentId,
  } = props;

  const ref = useRef<HTMLDivElement>(null);
  const hasScrolledInitially = useRef(false);
  const { setPreserveNextPrepend, measureBefore, correctAfter } =
    usePrependMessages(ref);

  const t = useTranslations('components/Messages');
  const [lastMessageReceived, setLastMessageReceived] =
    useState<LastMessageReceived | null>(null);
  const [initialized, setInitialized] = useState(false);

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
  const { data: includeErr = false } = useFeatureFlag('SHOW_ERRORED_MESSAGES');

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
        includeErr: includeErr,
        ...(query.pageParam.before ? { cursor: query.pageParam.before } : {}),
      })) as unknown as AgentMessage[];

      // Check if we've reached the end (less than MESSAGE_LIMIT results)
      if (Array.isArray(res) && res.length < MESSAGE_LIMIT) {
        setHasReachedEnd(true);
      }

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

  const {
    handleScroll,
    resetFlags,
    setHasReachedEnd,
    getIsAutoLoading,
    getHasReachedEnd,
    cleanup,
  } = useScrollHandler({
    ref,
    hasNextPage,
    isFetching,
    fetchNextPage,
    measureBefore,
    setPreserveNextPrepend,
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
      const isErroredMessage =
        'is_err' in agentMessage && agentMessage.is_err === true;
      if (mode === 'debug') {
        return {
          type: agentMessage.message_type,
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
          isError: isErroredMessage,
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
            type: agentMessage.message_type,
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
            isError: isErroredMessage,
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
            type: agentMessage.message_type,
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
            isError: isErroredMessage,
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
                  type: agentMessage.message_type,
                  raw: out.data.message,
                  name: 'Agent',
                  toolName: 'send_message',
                  editId: agentMessage.tool_call.tool_call_id || null,
                  timestamp: new Date(agentMessage.date).toISOString(),
                  isError: isErroredMessage,
                };
              } catch (_e) {
                return {
                  stepId: agentMessage.step_id,
                  id: `${agentMessage.id}-${agentMessage.message_type}`,
                  content: '',
                  toolName: 'send_message',
                  type: agentMessage.message_type,
                  timestamp: new Date(agentMessage.date).toISOString(),
                  name: 'Agent',
                  isError: isErroredMessage,
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
                type: agentMessage.message_type,
                toolName: agentMessage.tool_call.name || '',
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
                isError: isErroredMessage,
              };
            }

            return null;
          }

          return {
            stepId: agentMessage.step_id,
            type: agentMessage.message_type,
            id: `${agentMessage.id}-${agentMessage.message_type}`,
            toolName: agentMessage.tool_call.name || '',
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
            isError: isErroredMessage,
          };
        }
        case 'reasoning_message':
          if (mode === 'simple') {
            return null;
          }

          if (mode === 'interactive') {
            return {
              type: agentMessage.message_type,
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              editId: agentMessage.id,
              raw: agentMessage.reasoning,
              content: (
                <BlockQuote fullWidth>
                  <VStack gap="small">
                    <HStack align="center" justify="spaceBetween">
                      <HStack align="center" gap="small">
                        <InnerMonologueIcon color="violet" size="small" />
                        <Typography semibold color="violet" variant="body3">
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
                    <Typography color="lighter" variant="body3">
                      {agentMessage.reasoning}
                    </Typography>
                  </VStack>
                </BlockQuote>
              ),
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'Agent',
              isError: isErroredMessage,
            };
          }

          return {
            type: agentMessage.message_type,
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
                <Typography variant="body3">
                  {agentMessage.reasoning}
                </Typography>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
            isError: isErroredMessage,
          };
        case 'hidden_reasoning_message':
          if (mode === 'simple') {
            return null;
          }
          if (mode === 'interactive') {
            return {
              type: agentMessage.message_type,
              stepId: agentMessage.step_id,
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: (
                <BlockQuote fullWidth>
                  <VStack gap="small">
                    <HStack align="center" gap="small">
                      <InnerMonologueIcon color="violet" size="small" />
                      <Typography semibold color="violet" variant="body3">
                        {t('reasoning')}
                      </Typography>
                    </HStack>
                    <Typography
                      semibold
                      uppercase
                      variant="body3"
                      color="muted"
                    >
                      {(agentMessage.state === 'omitted'
                        ? 'hidden'
                        : agentMessage.state) + ' by model provider'}
                    </Typography>
                  </VStack>
                </BlockQuote>
              ),
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'Agent',
              isError: isErroredMessage,
            };
          }

          return {
            type: agentMessage.message_type,
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
                <Typography variant="body3">
                  {(agentMessage.state === 'omitted'
                    ? 'hidden'
                    : agentMessage.state) + ' by model provider'}
                </Typography>
              </MessageWrapper>
            ),
            timestamp: new Date(agentMessage.date).toISOString(),
            name: 'Agent',
            isError: isErroredMessage,
          };
        case 'user_message': {
          const content = agentMessage.content as
            | LettaUserMessageContentUnion[]
            | string;
          if (Array.isArray(content)) {
            if (mode === 'simple' || mode === 'interactive') {
              return {
                type: agentMessage.message_type,
                stepId: agentMessage.step_id,
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: <ContentPartsRenderer contentParts={content} />,
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'User',
                isError: isErroredMessage,
              };
            }
          } else {
            let parsedJSON: object | undefined;
            try {
              parsedJSON = JSON.parse(content);

              if (!isObject(parsedJSON)) {
                parsedJSON = undefined;
              }
            } catch {
              parsedJSON = undefined;
            }

            if (mode === 'simple' || mode === 'interactive') {
              if (parsedJSON) {
                if ('type' in parsedJSON && parsedJSON.type === 'heartbeat') {
                  return null;
                }

                if (
                  'type' in parsedJSON &&
                  parsedJSON.type === 'system_alert'
                ) {
                  return null;
                }

                if ('type' in parsedJSON && parsedJSON.type === 'login') {
                  return null;
                }

                return {
                  type: agentMessage.message_type,
                  stepId: agentMessage.step_id,
                  id: `${agentMessage.id}-${agentMessage.message_type}`,
                  content: (
                    <VStack
                      border
                      padding="small"
                      color="background-grey"
                      className="rounded-sm"
                    >
                      <JSONViewer data={content} />
                    </VStack>
                  ),
                  raw: content,
                  timestamp: new Date(agentMessage.date).toISOString(),
                  name: 'User',
                  editId: agentMessage.id,
                  isError: isErroredMessage,
                };
              }

              return {
                type: agentMessage.message_type,
                stepId: agentMessage.step_id,
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: (
                  <VStack>
                    <Markdown text={agentIdWrapper(content)} />
                  </VStack>
                ),
                raw: content,
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'User',
                editId: agentMessage.id,
                isError: isErroredMessage,
              };
            }

            if (parsedJSON) {
              const tryParseResp = tryFallbackParseJson(content);

              if (tryParseResp) {
                return {
                  type: agentMessage.message_type,
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
                  editId: agentMessage.id,
                  isError: isErroredMessage,
                };
              }

              return {
                type: agentMessage.message_type,
                stepId: agentMessage.step_id,
                id: `${agentMessage.id}-${agentMessage.message_type}`,
                content: <Markdown text={content} />,
                raw: content,
                timestamp: new Date(agentMessage.date).toISOString(),
                name: 'User',
                editId: agentMessage.id,
                isError: isErroredMessage,
              };
            }

            return {
              type: agentMessage.message_type,
              stepId: agentMessage.step_id,
              id: `${agentMessage.id}-${agentMessage.message_type}`,
              content: <Markdown text={content} />,
              raw: content,
              timestamp: new Date(agentMessage.date).toISOString(),
              name: 'User',
              isError: isErroredMessage,
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
      .sort((a, b) => {
        if (!a || !b) return 0;

        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();

        // if dates are the same, order by id
        if (dateA === dateB) {
          return a.id.localeCompare(b.id);
        }

        return dateA - dateB;
      });

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
        toolName: message.toolName || '',
        raw: message.raw || '',
        type: message.type || 'user_message',
        editId: message.editId || null,
        isError: message.isError || false,
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

  // Fast initial positioning - happens before paint
  useLayoutEffect(() => {
    if (
      !ref.current ||
      hasScrolledInitially.current ||
      messageGroups.length === 0
    ) {
      return;
    }

    const scroller = ref.current;
    const prev = scroller.style.scrollBehavior;

    scroller.style.scrollBehavior = 'auto'; // Disable smooth scroll for instant positioning
    scroller.scrollTop = scroller.scrollHeight; // Jump to bottom
    scroller.style.scrollBehavior = prev || '';

    hasScrolledInitially.current = true;
    setInitialized(true); // Reveal after positioning
  }, [messageGroups.length]);

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

  const AutoLoadIndicator = useMemo(() => {
    const isLoading = (getIsAutoLoading() || isFetching) && !getHasReachedEnd();

    // Don't show indicator if we've reached the end or there's nothing more to load
    if (getHasReachedEnd() || !hasNextPage) {
      return null;
    }

    return (
      <div className="flex justify-center py-4 min-h-[32px]">
        {isLoading ? (
          <Spinner size="small" />
        ) : (
          <div className="w-4 h-4" /> // Invisible placeholder to maintain height
        )}
      </div>
    );
  }, [isFetching, hasNextPage, getIsAutoLoading, getHasReachedEnd]);

  const lastAgentId = useRef(agentId);

  // Reset flags when agentId changes
  useEffect(() => {
    if (lastAgentId.current === agentId) {
      return;
    }

    lastAgentId.current = agentId;

    resetFlags();
    setInitialized(false);
    hasScrolledInitially.current = false;
  }, [agentId, resetFlags]);

  // When the topmost rendered group changes (after a prepend), compensate scroll
  const firstRenderedId = messageGroups[0]?.id;
  useLayoutEffect(() => {
    if (ref.current) {
      // Will no-op unless setPreserveNextPrepend(true) was called
      correctAfter(ref.current);
    }
  }, [firstRenderedId, correctAfter]);

  useEffect(() => {
    const scrollContainer = ref.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      cleanup();
    };
  }, [handleScroll, cleanup]);

  return (
    <VStack collapseHeight flex overflow="hidden">
      <VStack
        data-testid="messages-list"
        ref={ref}
        fullWidth
        fullHeight
        overflowY="auto"
        className={cn(
          'relative scroll-smooth',
          !initialized && 'pointer-events-none',
          // Simple visibility: show if we have messages or if initialized
          messageGroups.length > 0 || initialized ? 'visible' : 'invisible',
        )}
        gap="small"
        padding="small"
      >
        {AutoLoadIndicator}
        {injectSpaceForHeader && <div style={{ minHeight: 35 }} />}
        {messageGroups.map((group, index) => (
          <MessageGroup
            disableInteractivity={disableInteractivity}
            key={group.id}
            group={group}
            dataAnchor={index === 0 ? 'old-first' : undefined}
          />
        ))}
        {hasNextPage && messageGroups.length === 0 && mode === 'simple' && (
          <Alert variant="info" title={t('noParsableMessages')} />
        )}
      </VStack>
      <div
        className={cn(
          'absolute w-full overflow-hidden h-full top-0 left-0 items-center justify-center transition-opacity duration-500',
          !(
            data &&
            !hasNextPage &&
            messageGroups.length === 0 &&
            mode !== 'simple'
          )
            ? 'opacity-0 pointer-events-none'
            : '',
        )}
      >
        <LoadingEmptyStatusComponent
          loaderVariant="spinner"
          loaderFillColor="background-grey"
          emptyMessage={t('noMessages')}
        />
      </div>
      <div
        className={cn(
          'absolute w-full overflow-hidden h-full top-0 left-0 items-center justify-center transition-opacity duration-500',
          data ? 'opacity-0 pointer-events-none' : '',
        )}
      >
        <LoadingEmptyStatusComponent
          isLoading
          loaderFillColor="background-grey"
          hideText
          loaderVariant="spinner"
        />
      </div>
    </VStack>
  );
}
