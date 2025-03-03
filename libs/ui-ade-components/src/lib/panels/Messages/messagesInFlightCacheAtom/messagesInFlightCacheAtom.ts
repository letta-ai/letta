import { atom } from 'jotai';
import type { AgentMessage } from '@letta-cloud/sdk-core';

export const messagesInFlightCacheAtom = atom<Record<string, AgentMessage[]>>(
  {},
);
