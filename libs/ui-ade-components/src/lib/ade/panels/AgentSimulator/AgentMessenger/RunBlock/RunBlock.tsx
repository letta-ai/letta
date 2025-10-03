import type { RunResponse, RunResponseMessage } from '../../../../../hooks';
import { HStack, Typography, VStack } from '@letta-cloud/ui-component-library';
import { Fragment, useMemo } from 'react';
import { RoleAvatar } from '../shared/RoleAvatar/RoleAvatar';
import type { MessageRole, ToolReturnMessage } from '@letta-cloud/sdk-core';
import { MessageRenderer } from '../MessageRenderer/MessageRenderer';
import type { MessageAdditionalMetadata } from '../messages/types';
import { StepIndicator } from '../shared/StepIndicator/StepIndicator';
import { useFormatters } from '@letta-cloud/utils-client';
import './RunBlock.scss';
import { RunDetails } from './RunDetails/RunDetails';

interface MessageItemProps {
  message: RunResponseMessage;
  index: number;
  orderedMessages: RunResponseMessage[];
  toolReturnMessages: Record<string, ToolReturnMessage>;
  isRunComplete: boolean;
  currentRole: MessageRole;
  totalRunTime?: number | null;
  lastRoleChanged: boolean;
}

function MessageItem(props: MessageItemProps) {
  const {
    message,
    index,
    orderedMessages,
    currentRole,
    toolReturnMessages,
    isRunComplete,
    lastRoleChanged,
    totalRunTime,
  } = props;

  // Generate metadata for this message
  const hasNextMessage = index < orderedMessages.length - 1;
  const isLastStep = index === orderedMessages.length - 1;

  const toolReturnMessage =
    message.message_type === 'tool_call_message' ||
    (message.message_type === 'approval_request_message' &&
      'tool_call_id' in message.tool_call)
      ? toolReturnMessages[message.tool_call.tool_call_id || '']
      : undefined;

  const messageToSet = message;

  if (
    message.message_type === 'tool_call_message' ||
    message.message_type === 'approval_request_message'
  ) {
    // set the stepId of the tool_call_message to the tool_return_message's stepId if it exists
    if (
      toolReturnMessage &&
      toolReturnMessage.step_id &&
      messageToSet.message_type === 'tool_call_message'
    ) {
      messageToSet.step_id = toolReturnMessage.step_id;
    }
  }

  const metadata: MessageAdditionalMetadata = {
    hasNextMessageOrComplete: hasNextMessage || isRunComplete,
    nextMessage: hasNextMessage ? orderedMessages[index + 1] : null,
    toolReturnMessage,
  };

  const toolStatus = useMemo(() => {
    // if its a tool_call_message and has toolReturnMessage and the toolReturnMessage status is success
    if (message.message_type === 'tool_call_message' && toolReturnMessage) {
      return toolReturnMessage.status;
    }

    return undefined;
  }, [message, toolReturnMessage]);

  const isLastRunningStep = isLastStep && !isRunComplete;

  const isThinkingSpecialMessage = useMemo(() => {
    return (
      message.message_type === 'assistant_message' &&
      message.id === 'thinking' &&
      !hasNextMessage
    );
  }, [message, hasNextMessage]);

  const showStepError = useMemo(() => {
    return (
      message.message_type === 'run_error_message' ||
      (message.message_type === 'tool_call_message' && toolStatus === 'error')
    );
  }, [message, toolStatus]);

  const { formatSmallDuration } = useFormatters();

  if (isThinkingSpecialMessage) {
    return <RoleAvatar isRunning role={currentRole} />;
  }

  return (
    <Fragment>
      {lastRoleChanged && (
        <>
          {currentRole === 'assistant' ? (
            <HStack  className="avatar-container" fullWidth justify="spaceBetween" align="center">
              <RoleAvatar role={currentRole} />
              {totalRunTime && (
                <Typography className="total-duration" variant="body4" color="muted">
                  {formatSmallDuration(totalRunTime * 1_000_000)}
                </Typography>
              )}
            </HStack>
          ) : (
            <RoleAvatar role={currentRole} />
          )}
        </>
      )}
      <HStack fullWidth position="relative">
        {currentRole !== 'user' && (
          <StepIndicator
            isLastStep={isLastStep}
            isRunning={isLastRunningStep}
            isSuccess={toolStatus === 'success'}
            isError={showStepError}
          />
        )}
        <MessageRenderer
          isRunComplete={isRunComplete}
          message={message}
          metadata={metadata}
        />
      </HStack>
    </Fragment>
  );
}

interface RunBlockProps {
  runResponse: RunResponse;
  forceShowAgent?: boolean;
}

export function RunBlock(props: RunBlockProps) {
  const { runResponse } = props;

  const orderedMessages = useMemo(() => {
    // do not render stop_reason or usage_statistics messages
    const next = runResponse.messages.filter(
      (msg) =>
        msg.message_type !== 'stop_reason' &&
        msg.message_type !== 'usage_statistics' &&
        msg.message_type !== 'tool_return_message' &&
        msg.message_type !== 'ping',
    );

    if (runResponse.requestError) {
      next.push({
        id: 'error',
        message_type: 'run_error_message',
        error: runResponse.requestError,
      });
    } else {
      // if the most recent message is an user_message, append an empty assistant_message to indicate the agent is thinking
      if (
        runResponse.run.status === 'running' &&
        (runResponse.messages.length === 1 ||
          runResponse.messages.every((m) => m.message_type === 'user_message'))
      ) {
        next.push({
          id: 'thinking',
          message_type: 'assistant_message',
          content: [
            {
              type: 'text',
              text: '',
            },
          ],
          date: new Date().toISOString(),
          step_id: null,
        });
      }
    }

    return next;
  }, [runResponse.messages, runResponse.run.status, runResponse.requestError]);

  const toolReturnMessages = useMemo(
    () =>
      runResponse.messages
        .filter((message) => message.message_type === 'tool_return_message')
        .reduce(
          (acc, message) => {
            if (message.message_type === 'tool_return_message') {
              acc[message.tool_call_id] = message;
            }

            return acc;
          },
          {} as Record<string, ToolReturnMessage>,
        ),
    [runResponse.messages],
  );

  // Check if run is complete (not running)
  const isRunComplete = useMemo(() => {
    return runResponse.run.status !== 'running';
  }, [runResponse.run.status]);

  let lastRole: MessageRole = 'assistant';

  const startTime = useMemo(() => {
    if (runResponse.run.created_at) {
      return new Date(runResponse.run.created_at).getTime();
    }

    return null;
  }, [runResponse.run.created_at]);

  const totalRunTime = useMemo(() => {
    // look at when the first message with a date was sent and the last message with a date was sent
    if (orderedMessages.length === 0) {
      return null;
    }

    if (!startTime) {
      return null;
    }

    if (!isRunComplete) {
      return null;
    }

    const endMessage = orderedMessages[orderedMessages.length - 1];
    if (!('date' in endMessage) || !endMessage.date) {
      return null;
    }

    const endTime = new Date(endMessage.date).getTime();

    return endTime - startTime;
  }, [orderedMessages, startTime, isRunComplete]);

  // if the only message is thinking, do not render anything
  if (
    orderedMessages.length === 1 &&
    orderedMessages[0].message_type === 'assistant_message' &&
    orderedMessages[0].id === 'thinking'
  ) {
    return null;
  }

  return (
    <VStack className="run-block" position="relative" paddingTop="small">
      {orderedMessages.map((message, index) => {
        const currentRole: MessageRole =
          message.message_type === 'user_message' ? 'user' : 'assistant';

        const lastRoleChanged = lastRole !== currentRole || index === 0;

        lastRole = currentRole;

        return (
          <MessageItem
            key={index}
            message={message}
            index={index}
            // so we dont re-render, since totalRunTime is only rendered in the Avatar
            totalRunTime={lastRoleChanged && totalRunTime ? totalRunTime : null}
            orderedMessages={orderedMessages}
            toolReturnMessages={toolReturnMessages}
            isRunComplete={isRunComplete}
            currentRole={currentRole}
            lastRoleChanged={lastRoleChanged}
          />
        );
      })}
      <div className="absolute bottom-0 right-0 run-block__details">
        <RunDetails run={runResponse.run} />
      </div>
    </VStack>
  );
}
