import { ApplicationServices } from './services';
import { z } from 'zod';

export const UserPresetRoles = z.enum(['admin', 'editor', 'custom']);

export type UserPresetRolesType = z.infer<typeof UserPresetRoles>;

const analystPermissions = [
  ApplicationServices.READ_AGENT,
  ApplicationServices.MESSAGE_AGENT,
];

const editorPermissions = [
  ...analystPermissions,
  ApplicationServices.CREATE_API_KEY,
  ApplicationServices.READ_API_KEYS,
  ApplicationServices.CREATE_AGENT,
  ApplicationServices.DELETE_AGENT,
  ApplicationServices.UPDATE_AGENT,
  ApplicationServices.CREATE_TOOL,
  ApplicationServices.DELETE_TOOL,
  ApplicationServices.READ_TOOL,
  ApplicationServices.UPDATE_TOOL,
  ApplicationServices.CREATE_DATA_SOURCE,
  ApplicationServices.DELETE_DATA_SOURCE,
  ApplicationServices.READ_DATA_SOURCE,
  ApplicationServices.UPDATE_DATA_SOURCE,
  ApplicationServices.UPDATE_ORGANIZATION_ENVIRONMENT_VARIABLES,
];

const adminPermissions = [
  ...editorPermissions,
  ApplicationServices.CREATE_API_KEY,
  ApplicationServices.READ_API_KEYS,
  ApplicationServices.DELETE_API_KEY,
  ApplicationServices.UPDATE_USERS_IN_ORGANIZATION,
  ApplicationServices.UPDATE_ORGANIZATION,
  ApplicationServices.MANAGE_BILLING,
  ApplicationServices.CONNECT_INTEGRATIONS,
];

export const roleToServicesMap: Record<
  UserPresetRolesType,
  ApplicationServices[]
> = {
  admin: adminPermissions,
  editor: editorPermissions,
  custom: [],
};
