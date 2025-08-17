import type { db } from './lib/database';

export * from './lib/database';
export * from './schemas';

export type TxType = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];
