import { atomWithStorage } from 'jotai/utils';
export type ADETourSteps =
  | 'chat'
  | 'core_memories'
  | 'tools'
  | 'welcome'
  | null;

export const adeTourStepAtom = atomWithStorage<ADETourSteps>(
  'ade-tour-step',
  null,
);
