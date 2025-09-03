import type { ToolCallMessage, ToolReturnMessage } from '@letta-cloud/sdk-core';
import { FunctionCall } from '@letta-cloud/ui-component-library';
import React from 'react';

interface InteractiveToolCallMessageProps {
  message: ToolCallMessage;
  toolReturnMessage?: ToolReturnMessage;
}

export function InteractiveToolCallMessage(
  props: InteractiveToolCallMessageProps,
) {
  const { message, toolReturnMessage } = props;
  const { tool_call, name, id } = message;

  return (
    <FunctionCall
      id={id}
      key={name}
      name={tool_call.name || ''}
      inputs={tool_call.arguments || ''}
      response={toolReturnMessage}
      status={toolReturnMessage?.status}
    />
  );
}
