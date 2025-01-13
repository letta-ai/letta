import { atom } from 'jotai';
import type { AgentMessage } from '@letta-cloud/letta-agents-api';

export const messagesInFlightCacheAtom = atom<Record<string, AgentMessage[]>>(
  {},
);
