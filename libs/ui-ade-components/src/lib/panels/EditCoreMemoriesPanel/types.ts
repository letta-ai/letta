export const CoreMemoryBlock = {
  CUSTOM: 'custom',
  EXAMPLE: 'example',
};

export type CoreMemoryBlockType =
  (typeof CoreMemoryBlock)[keyof typeof CoreMemoryBlock];
