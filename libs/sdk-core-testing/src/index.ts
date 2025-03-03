import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep, mockReset } from 'jest-mock-extended';

import type * as api from '@letta-cloud/sdk-core';
const lettaAgentAPIMock: DeepMockProxy<typeof api> = mockDeep();

jest.mock('@letta-cloud/sdk-core', () => lettaAgentAPIMock);

beforeEach(() => {
  mockReset(lettaAgentAPIMock);
});

export { lettaAgentAPIMock };
