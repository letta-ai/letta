'use client';
import { useParams } from 'next/navigation';

export function useCurrentAgentId() {
  const { agentId } = useParams<{ agentId: string }>();

  return agentId;
}
