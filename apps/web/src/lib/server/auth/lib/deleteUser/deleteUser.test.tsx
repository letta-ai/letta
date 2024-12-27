import { mockDatabase, mockDatabaseDelete } from '@letta-web/database-testing';
import { deleteUser } from '$web/server/auth/lib/deleteUser';
import { eq } from 'drizzle-orm';
import { organizations, users } from '@letta-web/database';

jest.mock('@letta-web/database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-web/database'),
  db: mockDatabase,
}));

describe('deleteUser', () => {
  it('should delete user and any organizations where user is the sole member', async () => {
    const userId = '1';

    const { whereFn } = mockDatabaseDelete();
    mockDatabase.query.organizationUsers.findMany.mockResolvedValueOnce([
      {
        organizationId: '1',
        userId,
      },
      {
        organizationId: '2',
        userId,
      },
    ]);

    mockDatabase.query.organizationUsers.findMany.mockResolvedValueOnce([
      {
        organizationId: '1',
        userId,
      },
      {
        organizationId: '1',
        userId: '2',
      },
    ]);

    mockDatabase.query.organizationUsers.findMany.mockResolvedValueOnce([
      {
        organizationId: '2',
        userId,
      },
    ]);

    await deleteUser(userId);

    expect(whereFn).toHaveBeenNthCalledWith(1, eq(organizations.id, '2'));

    expect(whereFn).toHaveBeenNthCalledWith(2, eq(users.id, userId));
  });
});
