import type { ToolCallMessage } from '@letta-cloud/sdk-core';
import type { MessageAdditionalMetadata } from '../types';
import { FunctionCall } from '@letta-cloud/ui-component-library';
import React from 'react';

interface ToolCallMessageComponentProps {
  message: ToolCallMessage;
  metadata: MessageAdditionalMetadata;
}

export function ToolCallMessageComponent(props: ToolCallMessageComponentProps) {
  const { message, metadata } = props;
  const { tool_call, name, id } = message;

  const toolReturnMessage = metadata.toolReturnMessage;

  return (
    <FunctionCall
      id={id}
      key={name}
      noStatusBadge
      name={tool_call.name || ''}
      inputs={tool_call.arguments || ''}
      response={toolReturnMessage || undefined}
      status={toolReturnMessage?.status}
    />
  )
}
