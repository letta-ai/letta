import { z } from 'zod';

export const userSessionSchema = z.object({
  email: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  theme: z.string(),
  activeOrganizationId: z.string(),
  isVerified: z.boolean(),
  id: z.string(),
  coreUserId: z.string(),
});

export type UserSession = z.infer<typeof userSessionSchema>;
