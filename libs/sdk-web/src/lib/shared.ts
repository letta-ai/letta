import { z } from 'zod';

export const GenericSearchSchema = z.object({
  search: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().max(100).optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

export type GenericSearch = z.infer<typeof GenericSearchSchema>;

export const GenericSearchWithCursorSchema = z.object({
  search: z.string().optional(),
  limit: z.number().optional(),
  cursor: z.string().optional(),
});

export const GenericPaginationSchema = z.object({
  nextCursor: z.string().optional(),
  prevCursor: z.string().optional(),
});

export type GenericPagination = z.infer<typeof GenericPaginationSchema>;
