import type { MessageType } from '@letta-cloud/sdk-core';

export interface AgentSimulatorMessageType {
  id: string;
  content: React.ReactNode;
  name: string;
  stepId?: string | null;
  timestamp: string;
  raw?: string;
  type: MessageType
  editId?: string | null;
}

export interface AgentSimulatorMessageGroupType {
  name: string;
  id: string;
  messages: AgentSimulatorMessageType[];
}
