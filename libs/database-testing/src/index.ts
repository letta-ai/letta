import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep, mockReset } from 'jest-mock-extended';

import type { db } from '@letta-web/database';

const mockDatabase: DeepMockProxy<typeof db> = mockDeep();

jest.mock('@letta-web/database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-web/database'),
  db: mockDatabase,
}));

beforeEach(() => {
  mockReset(mockDatabase);
});

function mockDatabaseInsert() {
  const returning = jest.fn(() => []);

  const values = jest.fn(() => ({
    returning,
  }));

  mockDatabase.insert.mockReturnValue({
    values: values,
  });

  return {
    valuesFn: values,
    returningFn: returning,
  };
}

export { mockDatabase, mockDatabaseInsert };
