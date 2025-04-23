import { createProject } from './projectsRouter';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { getCurrentOrganizationUsageLimits } from '@letta-cloud/utils-server';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { mockDatabase } from '@letta-cloud/service-database-testing';

jest.mock('$web/server/auth');
jest.mock('@letta-cloud/service-database');
jest.mock('@letta-cloud/utils-server');

const mockGetUserWithActiveOrganizationIdOrThrow =
  getUserWithActiveOrganizationIdOrThrow as jest.Mock;
const mockGetCurrentOrganizationUsageLimits =
  getCurrentOrganizationUsageLimits as jest.Mock;

describe('createProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 403 if the user does not have permission to create projects', async () => {
    mockGetUserWithActiveOrganizationIdOrThrow.mockResolvedValue({
      activeOrganizationId: 'org123',
      permissions: new Set(),
    });

    const req = {
      body: { name: 'Test Project' },
    };

    const result = await createProject(req as any);

    expect(result).toEqual({
      status: 403,
      body: { errorCode: 'noPermission' },
    });
  });

  it('should return 400 if the project limit is reached', async () => {
    mockGetUserWithActiveOrganizationIdOrThrow.mockResolvedValue({
      activeOrganizationId: 'org123',
      permissions: new Set([ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS]),
    });

    mockDatabase.query.projects.findFirst.mockResolvedValue(undefined);
    mockDatabase.select.mockImplementation(() => ({
      from: () => ({
        where: () => [
          {
            count: 5,
          },
        ],
      }),
    }));
    mockGetCurrentOrganizationUsageLimits.mockResolvedValue({
      projects: 5,
    });

    const req = {
      body: { name: 'Test Project' },
    };

    const result = await createProject(req as any);

    expect(result).toEqual({
      status: 400,
      body: { errorCode: 'projectLimitReached' },
    });
  });

  it('should create a project and return 201 with the project details', async () => {
    mockGetUserWithActiveOrganizationIdOrThrow.mockResolvedValue({
      activeOrganizationId: 'org123',
      permissions: new Set([ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS]),
    });

    mockDatabase.query.projects.findFirst.mockResolvedValue(undefined);
    mockDatabase.select.mockImplementation(() => ({
      from: () => ({
        where: () => [
          {
            count: 0,
          },
        ],
      }),
    }));
    mockGetCurrentOrganizationUsageLimits.mockResolvedValue({
      projects: 5,
    });

    const req = {
      body: { name: 'Test Project' },
    };

    mockDatabase.insert.mockImplementation(() => {
      return {
        values: () => {
          return {
            returning: () => {
              return [{ id: '312123132' }];
            },
          };
        },
      };
    });

    const result = await createProject(req as any);

    expect(result).toEqual({
      status: 201,
      body: {
        id: expect.any(String),
        name: 'Test Project',
        slug: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });
});
