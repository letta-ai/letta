import type { ApprovalRequestMessage, ToolReturnMessage } from '@letta-cloud/sdk-core';
import { FunctionCall } from '@letta-cloud/ui-component-library';
import React from 'react';

interface RequiresApprovalMessageProps {
  message: ApprovalRequestMessage;
  toolReturnMessage?: ToolReturnMessage;
}

export function RequiresApprovalMessage(props: RequiresApprovalMessageProps) {
  const { message, toolReturnMessage } = props;

  if (toolReturnMessage) {
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

  return null;
}
