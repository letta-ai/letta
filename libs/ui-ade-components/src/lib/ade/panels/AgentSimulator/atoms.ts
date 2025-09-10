import { atom } from 'jotai';
import type { MessagesDisplayMode } from '../Messages/types';

export const isSendingMessageAtom = atom(false);
export const chatroomRenderModeAtom = atom<MessagesDisplayMode>('interactive')
