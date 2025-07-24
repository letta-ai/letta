import { atom } from 'jotai/index';

interface CurrentAdvancedCoreMemoryState {
  selectedMemoryBlockLabel?: string;
  isOpen: boolean;
}

export const currentAdvancedCoreMemoryAtom =
  atom<CurrentAdvancedCoreMemoryState>({
    selectedMemoryBlockLabel: '',
    isOpen: false,
  });
