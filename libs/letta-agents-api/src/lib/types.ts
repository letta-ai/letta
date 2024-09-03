export interface AttachedAgent {
  id: string;
  name: string;
}

export interface SourceMetadata {
  num_documents: number;
  num_passages: number;
  attached_agents: AttachedAgent[];
}
