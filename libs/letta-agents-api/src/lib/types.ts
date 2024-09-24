import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

export interface AttachedAgent {
  id: string;
  name: string;
}

export interface SourceMetadata {
  num_documents: number;
  num_passages: number;
  attached_agents: AttachedAgent[];
}

export const SystemMessageSchema = z.object({
  message_type: z.literal('system_message'),
  message: z.string(),
  date: z.string(),
  id: z.string(),
});

// this is the message schema if you parse `message` from UseMessageSchema
export const UserMessageMessageSchema = z.object({
  type: z.literal('user_message'),
  message: z.string(),
  time: z.string(),
});

export const UserMessageSchema = z.object({
  message_type: z.literal('user_message'),
  message: z.string(),
  date: z.string(),
  id: z.string(),
});

export const InternalMonologueSchema = z.object({
  message_type: z.literal('internal_monologue'),
  internal_monologue: z.string(),
  date: z.string(),
  id: z.string(),
});

export const SendMessageFunctionCallSchema = z.object({
  message: z.string(),
});

export const FunctionCallSchema = z.object({
  message_type: z.literal('function_call'),
  function_call: z.object({
    message_type: z.literal('function_call').optional(),
    type: z.literal('function_call').optional(),
    name: z.string().optional(),
    arguments: z.string().optional(),
  }),
  date: z.string(),
  id: z.string(),
});

export const FunctionReturnSchema = z.object({
  message_type: z.literal('function_return'),
  function_return: z.string(),
  status: z.string(),
  date: z.string(),
  id: z.string(),
});

export const AgentMessageSchema = z.discriminatedUnion('message_type', [
  FunctionReturnSchema,
  FunctionCallSchema,
  InternalMonologueSchema,
  UserMessageSchema,
  SystemMessageSchema,
]);

export const AgentMessageTypeSchema = z.enum([
  'function_return',
  'function_call',
  'internal_monologue',
  'user_message',
  'system_message',
]);

export function safeParseFunctionCallArguments(
  message: z.infer<typeof FunctionCallSchema>
): Record<string, any> {
  try {
    return JSON.parse(jsonrepair(message.function_call.arguments || '{}'));
  } catch (_e) {
    return {};
  }
}

export type AgentMessage = z.infer<typeof AgentMessageSchema>;
