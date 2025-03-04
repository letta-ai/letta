import { ApplicationServices } from '@letta-cloud/service-rbac';

export type MethodType = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export const publicAPIPMatchers = [
  {
    path: new RegExp('/v1/agents/(.+)/message'),
    methods: {
      POST: ApplicationServices.MESSAGE_AGENT,
    },
  },
  {
    path: new RegExp('/v1/agents/(.+)?'),
    methods: {
      GET: ApplicationServices.READ_AGENT,
      POST: ApplicationServices.CREATE_AGENT,
      DELETE: ApplicationServices.DELETE_AGENT,
      PATCH: ApplicationServices.UPDATE_AGENT,
      PUT: ApplicationServices.UPDATE_AGENT,
    },
  },
  {
    path: new RegExp('/v1/tools/(.+)?'),
    methods: {
      GET: ApplicationServices.READ_TOOL,
      POST: ApplicationServices.CREATE_TOOL,
      DELETE: ApplicationServices.DELETE_TOOL,
      PATCH: ApplicationServices.UPDATE_TOOL,
      PUT: ApplicationServices.UPDATE_TOOL,
    },
  },
  {
    path: new RegExp('/v1/souces/(.+)?'),
    methods: {
      GET: ApplicationServices.READ_DATA_SOURCE,
      POST: ApplicationServices.CREATE_DATA_SOURCE,
      DELETE: ApplicationServices.DELETE_DATA_SOURCE,
      PATCH: ApplicationServices.UPDATE_DATA_SOURCE,
      PUT: ApplicationServices.UPDATE_DATA_SOURCE,
    },
  },
  {
    path: new RegExp('/v1'),
    methods: {
      GET: ApplicationServices.READ_AGENT,
      POST: ApplicationServices.CREATE_AGENT,
      DELETE: ApplicationServices.DELETE_AGENT,
      PATCH: ApplicationServices.UPDATE_AGENT,
      PUT: ApplicationServices.UPDATE_AGENT,
    },
  },
];

/*
Find the permission for a given path and method, if that path has no explicit permission, return the permission of the parent path

 */
export function getPermissionForSDKPath(path: string, method: MethodType) {
  for (const matcher of publicAPIPMatchers) {
    if (matcher.path.test(path) && matcher.methods[method]) {
      return matcher.methods[method];
    }
  }

  return null;
}
