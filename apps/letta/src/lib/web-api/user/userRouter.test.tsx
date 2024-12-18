import { mockDatabase, mockDatabaseUpdate } from '@letta-web/database-testing';
import { router } from '$letta/web-api/router';
import { lettaAgentAPIMock } from '@letta-web/letta-agents-api-testing';

jest.mock('@letta-web/database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-web/database'),
  db: mockDatabase,
}));

jest.mock('$letta/server/auth', () => ({
  __esModule: true,
  ...jest.requireActual('$letta/server/auth'),
  getUser: jest.fn(() => ({
    id: '123',
    theme: 'light',
    name: 'test',
    lettaAgentsId: '456',
  })),
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
