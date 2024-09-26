'use client';
import { useParams } from 'next/navigation';

export function useCurrentTestingAgentId() {
  const { agentId } = useParams<{ agentId: string }>();

  return agentId;
}
