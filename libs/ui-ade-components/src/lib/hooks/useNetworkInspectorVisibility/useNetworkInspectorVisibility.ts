'use client';
import { atom, useAtom } from 'jotai';

const networkInspectorVisibilityAtom = atom<boolean>(false);

export function useNetworkInspectorVisibility() {
  return useAtom(networkInspectorVisibilityAtom);
}
