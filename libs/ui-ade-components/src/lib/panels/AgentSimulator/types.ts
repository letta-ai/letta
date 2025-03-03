export interface AgentSimulatorMessageType {
  id: string;
  content: React.ReactNode;
  name: string;
  timestamp: string;
}

export interface AgentSimulatorMessageGroupType {
  name: string;
  id: string;
  messages: AgentSimulatorMessageType[];
}
