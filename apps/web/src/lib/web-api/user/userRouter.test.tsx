import {
  mockDatabase,
  mockDatabaseUpdate,
} from '@letta-cloud/service-database-testing';
import { router } from '$web/web-api/router';
import { lettaAgentAPIMock } from '@letta-cloud/sdk-core-testing';

jest.mock('@letta-cloud/service-database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-cloud/service-database'),
  db: mockDatabase,
}));

jest.mock('$web/server/auth', () => ({
  __esModule: true,
  ...jest.requireActual('$web/server/auth'),
  getUser: jest.fn(() => ({
    id: '123',
    theme: 'light',
    name: 'test',
    lettaAgentsId: '456',
  })),
}));

jest.mock('$web/server/cookies', () => ({
  __esModule: true,
  ...jest.requireActual('$web/server/cookies'),
  getCookie: jest.fn(async () => ({
    sessionId: 'session-id',
    expires: Date.now() + 1000 * 60 * 60 * 24,
  })),
}));

jest.mock('@letta-cloud/service-redis', () => ({
  getRedisData: jest.fn(() => ({
    name: 'test',
    lettaAgentsId: '456',
    activeOrganizationId: '123',
    id: '123',
  })),
  setRedisData: jest.fn(),
}));

describe('userRouter', () => {
  describe('updateActiveOrganization', () => {
    it("should update a user's organization successfully", async () => {
      mockDatabase.query.organizations.findFirst.mockResolvedValue({
        id: '123',
        name: 'test',
        lettaAgentsId: 'abc',
        updatedAt: new Date(),
        createdAt: new Date(),
        isAdmin: false,
        deletedAt: null,
      });

      const { setFn } = mockDatabaseUpdate();

      //
      const response = await router.user.updateActiveOrganization({
        body: {
          activeOrganizationId: '123',
        },
      });

      expect(response).toEqual({
        status: 200,
        body: {
          success: true,
        },
      });

      expect(lettaAgentAPIMock.AdminService.updateUser).toHaveBeenCalledWith({
        requestBody: {
          id: '456',
          organization_id: 'abc',
        },
      });

      expect(setFn).toHaveBeenCalledWith({ activeOrganizationId: '123' });
    });
  });
});
