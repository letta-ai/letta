import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep, mockReset } from 'jest-mock-extended';

import type { db } from '@letta-cloud/service-database';

const mockDatabase: DeepMockProxy<typeof db> = mockDeep();

jest.mock('@letta-cloud/service-database', () => ({
  __esModule: true,
  ...jest.requireActual('@letta-cloud/service-database'),
  db: mockDatabase,
}));

beforeEach(() => {
  mockReset(mockDatabase);
});

function mockDatabaseInsert() {
  const returning = jest.fn(() => []);

  const onConflictDoUpdate = jest.fn(() => ({
    returning,
  }));

  const onConflictDoNothing = jest.fn(() => ({
    returning,
  }));

  const values = jest.fn(() => ({
    returning,
    onConflictDoUpdate,
    onConflictDoNothing,
  }));

  mockDatabase.insert.mockReturnValue({
    values: values,
  } as any);

  return {
    valuesFn: values,
    returningFn: returning,
    onConflictDoUpdateFn: onConflictDoUpdate,
    onConflictDoNothingFn: onConflictDoNothing,
  };
}

export function mockDatabaseUpdate() {
  const returning = jest.fn(() => []);
  const where = jest.fn();

  const set = jest.fn(() => ({
    returning,
    where,
  }));

  mockDatabase.update.mockReturnValue({
    set,
  } as any);

  return {
    setFn: set,
    returningFn: returning,
    whereFn: where,
  };
}

export function mockDatabaseDelete() {
  const where = jest.fn();

  mockDatabase.delete.mockReturnValue({
    where,
  } as any);

  return {
    whereFn: where,
  };
}

export { mockDatabase, mockDatabaseInsert };
