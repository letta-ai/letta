import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { type GenericSearch, GenericSearchSchema } from '../shared';

const c = initContract();

/* Get whitelisted emails */
export const WhitelistedEmailSchema = z.object({
  email: z.string(),
  id: z.string(),
});

export const WhitelistedEmailsSchema = z.object({
  emails: z.array(WhitelistedEmailSchema),
  hasNextPage: z.boolean(),
});

export type WhitelistedEmailType = z.infer<typeof WhitelistedEmailSchema>;

export type WhitelistedEmailsType = z.infer<typeof WhitelistedEmailsSchema>;

const getWhitelistedEmailsContract = c.query({
  method: 'GET',
  query: GenericSearchSchema,
  path: '/admin/whitelisted-emails',
  responses: {
    200: WhitelistedEmailsSchema,
  },
});

/* Delete whitelisted email */
const deleteWhitelistedEmailContract = c.mutation({
  method: 'DELETE',
  path: '/admin/whitelisted-emails/:whitelistedEmailId',
  responses: {
    204: null,
  },
  body: null,
});

/* Create whitelisted email */
export const CreateWhitelistedEmailPayloadSchema = z.object({
  email: z.string(),
});

const createWhitelistedEmailContract = c.mutation({
  method: 'POST',
  path: '/admin/whitelisted-emails',
  body: CreateWhitelistedEmailPayloadSchema,
  responses: {
    201: WhitelistedEmailSchema,
  },
});

export const adminWhitelistedEmailsContract = c.router({
  getWhitelistedEmails: getWhitelistedEmailsContract,
  deleteWhitelistedEmail: deleteWhitelistedEmailContract,
  createWhitelistedEmail: createWhitelistedEmailContract,
});

export const adminWhitelistedEmailsQueryKeys = {
  getWhitelistedEmails: ['admin', 'whitelisted-emails'],
  getWhitelistedEmailsWithSearch: (search: GenericSearch) => [
    ...adminWhitelistedEmailsQueryKeys.getWhitelistedEmails,
    search,
  ],
};
