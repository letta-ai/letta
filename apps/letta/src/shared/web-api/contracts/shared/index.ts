import { z } from 'zod';

export const GenericSearchSchema = z.object({
  search: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

export type GenericSearch = z.infer<typeof GenericSearchSchema>;
