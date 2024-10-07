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
  const values = jest.fn();

  mockDatabase.insert.mockReturnValue({
    values: values,
  });

  return {
    valuesFn: values,
  };
}

export { mockDatabase, mockDatabaseInsert };
