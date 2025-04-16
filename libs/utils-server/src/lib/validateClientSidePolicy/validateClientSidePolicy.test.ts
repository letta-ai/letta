import {
  validateAgentPolicy,
  validateClientSidePolicy,
} from './validateClientSidePolicy';
import type {
  AccessResource,
  ValidateAgentPolicyOptions,
} from './validateClientSidePolicy';
import type { AccessPolicyVersionOneType } from '@letta-cloud/types';

describe('validateClientSidePolicy', () => {
  it('should return true when all policies are valid for the resource', () => {
    const policy: AccessPolicyVersionOneType = {
      version: '1',
      data: [
        {
          type: 'agent',
          id: '123',
          access: ['read_agent'],
        },
      ],
    };

    const resource: AccessResource = {
      pathname: '/agents/123',
      method: 'GET',
    };

    const result = validateClientSidePolicy({
      policy,
      resource,
      coreUserId: 'user123',
    });

    expect(result).toBe(true);
  });

  it('should return false when at least one policy is invalid for the resource', () => {
    const policy: AccessPolicyVersionOneType = {
      version: '1',
      data: [
        {
          type: 'agent',
          id: '123',
          access: ['write_agent'],
        },
      ],
    };

    const resource: AccessResource = {
      pathname: '/agents/123',
      method: 'GET',
    };

    const result = validateClientSidePolicy({
      policy,
      resource,
      coreUserId: 'user123',
    });

    expect(result).toBe(false);
  });

  it('should return false when the policy type is not "agent"', () => {
    const policy: AccessPolicyVersionOneType = {
      version: '1',
      data: [
        {
          type: 'blah',
          id: '123',
          access: ['read_agent'],
        },
      ],
    } as unknown as AccessPolicyVersionOneType;

    const resource: AccessResource = {
      pathname: '/agents/123',
      method: 'GET',
    };

    const result = validateClientSidePolicy({
      policy,
      resource,
      coreUserId: 'user123',
    });

    expect(result).toBe(false);
  });

  it('should return false when the policy is empty', () => {
    const policy: AccessPolicyVersionOneType = {
      version: '1',
      data: [],
    };

    const resource: AccessResource = {
      pathname: '/agents/123',
      method: 'GET',
    };

    const result = validateClientSidePolicy({
      policy,
      resource,
      coreUserId: 'user123',
    });

    expect(result).toBe(false);
  });

  it('should return false when no policy is provided', () => {
    const resource: AccessResource = {
      pathname: '/agents/123',
      method: 'GET',
    };

    const result = validateClientSidePolicy({
      policy: null as any, // Simulating no policy
      resource,
      coreUserId: 'user123',
    });

    expect(result).toBe(false);
  });
});

describe('validateAgentPolicy', () => {
  it('should return true for valid POST request to base agent route with write_agent access', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '123',
        access: ['write_agent'],
      },
      resource: {
        pathname: '/agents/123',
        method: 'POST',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(true);
  });

  it('should return true for valid GET request to base agent route with read_agent access', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '123',
        access: ['read_agent'],
      },
      resource: {
        pathname: '/agents/123',
        method: 'GET',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(true);
  });

  it('should return false for POST request to base agent route without write_agent access', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '123',
        access: ['read_agent'],
      },
      resource: {
        pathname: '/agents/123',
        method: 'POST',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(false);
  });

  it('should return true for valid POST request to message agent route with write_messages access', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '123',
        access: ['write_messages'],
      },
      resource: {
        pathname: '/agents/123/messages',
        method: 'POST',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(true);
  });

  it('should return false for GET request to message agent route without read_messages access', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '123',
        access: ['write_messages'],
      },
      resource: {
        pathname: '/agents/123/messages',
        method: 'GET',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(false);
  });

  it('should return false if policy ID does not match agent ID in the resource', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '456',
        access: ['read_agent'],
      },
      resource: {
        pathname: '/agents/123',
        method: 'GET',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(false);
  });

  it('should return false for invalid resource path', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '123',
        access: ['read_agent'],
      },
      resource: {
        pathname: '/invalid/path',
        method: 'GET',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(false);
  });

  it('should return true for valid GET request to complex message agent route with read_messages access', () => {
    const options: ValidateAgentPolicyOptions = {
      policy: {
        type: 'agent',
        id: '123',
        access: ['read_messages'],
      },
      resource: {
        pathname: '/agents/123/messages/456',
        method: 'GET',
      },
      coreUserId: 'user123',
    };

    const result = validateAgentPolicy(options);
    expect(result).toBe(true);
  });
});
