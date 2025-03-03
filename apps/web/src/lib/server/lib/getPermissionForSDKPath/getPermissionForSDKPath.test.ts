import {
  getPermissionForSDKPath,
  publicAPIPMatchers,
} from '$web/server/lib/getPermissionForSDKPath/getPermissionForSDKPath';
import { ApplicationServices } from '@letta-cloud/service-rbac';

describe('getPermissionForSDKPath', () => {
  it('should return the correct permission for the path GET /v1/agents ', () => {
    const permission = getPermissionForSDKPath('/v1/agents', 'GET');

    expect(permission).toEqual(ApplicationServices.READ_AGENT);
  });

  it('should return the parent permission for a path that has no explicit permission', () => {
    const permission = getPermissionForSDKPath('/v1/agents/123', 'POST');

    expect(permission).toEqual(ApplicationServices.CREATE_AGENT);
  });

  it('should return the parent permission for a path that has no explicit permission', () => {
    const permission = getPermissionForSDKPath('/v1/sdafsafd', 'POST');

    expect(permission).toEqual(ApplicationServices.CREATE_AGENT);
  });

  it('should return the permission of a path that has parent paths but also has an explicit permission', () => {
    const permission = getPermissionForSDKPath(
      '/v1/agents/123/message',
      'POST',
    );

    expect(permission).toEqual(ApplicationServices.MESSAGE_AGENT);
  });

  it('should return the parent permission for a path that has no explicit permission for the method', () => {
    const permission = getPermissionForSDKPath('/v1/agents/123/message', 'GET');

    expect(permission).toEqual(ApplicationServices.READ_AGENT);
  });
});

describe('publicAPIPMatchers', () => {
  it('should have the longest paths before the shorter paths', () => {
    let largestPath = publicAPIPMatchers[0].path.source;

    for (let i = 1; i < publicAPIPMatchers.length; i++) {
      const path = publicAPIPMatchers[i].path.source;
      expect(path).not.toContain(largestPath);
      largestPath = path;
    }
  });
});
