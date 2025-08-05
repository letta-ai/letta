import { ApplicationServices } from './services';
import { z } from 'zod';

export const UserPresetRoles = z.enum(['admin', 'editor', 'analyst', 'custom']);

export type UserPresetRolesType = z.infer<typeof UserPresetRoles>;

const analystPermissions = [
  ApplicationServices.READ_PROJECTS,
  ApplicationServices.READ_AGENT,
  ApplicationServices.READ_DATA_SOURCE,
  ApplicationServices.READ_TOOL,
  ApplicationServices.READ_TEMPLATES,
  ApplicationServices.MESSAGE_AGENT,
  ApplicationServices.READ_DATASETS,
  ApplicationServices.READ_DATASET_ITEMS,
  ApplicationServices.READ_AB_TESTS,
];

const editorPermissions = [
  ...analystPermissions,
  ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS,
  ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
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
  ApplicationServices.UPDATE_DATA_SOURCE,
  ApplicationServices.UPDATE_ORGANIZATION_ENVIRONMENT_VARIABLES,
  ApplicationServices.CREATE_DATASETS,
  ApplicationServices.UPDATE_DATASETS,
  ApplicationServices.DELETE_DATASETS,
  ApplicationServices.CREATE_DATASET_ITEM,
  ApplicationServices.UPDATE_DATASET_ITEM,
  ApplicationServices.DELETE_DATASET_ITEM,
  ApplicationServices.CREATE_AB_TESTS,
  ApplicationServices.UPDATE_AB_TESTS,
  ApplicationServices.DELETE_AB_TESTS,
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
  analyst: analystPermissions,
  custom: [],
};
