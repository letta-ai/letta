import { atom } from 'jotai';

// make sure the open state is stored in an atom, as this component gets refreshed and can lose it's state
export const functionCallOpenStatusAtom = atom<Record<string, boolean>>();
