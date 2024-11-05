import { z } from 'zod';

export const redisTypes = z.enum(['userSession']);

export type RedisTypes = z.infer<typeof redisTypes>;

export const redisTypeKeyMap = {
  userSession: (key: string) => `userSession:${key}`,
} satisfies Record<RedisTypes, (v: string) => `${RedisTypes}:${string}`>;

export const redisUserSessionSchema = z.object({
  email: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  activeOrganizationId: z.string(),
  id: z.string(),
});

export type RedisUserSession = z.infer<typeof redisUserSessionSchema>;

export interface RedisKeySchemaMap {
  userSession: RedisUserSession;
}
