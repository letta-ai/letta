import { atom } from 'jotai';
import type { AgentMessage } from '@letta-web/letta-agents-api';

export const messagesInFlightCacheAtom = atom<AgentMessage[]>([]);
