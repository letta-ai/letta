import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep, mockReset } from 'jest-mock-extended';

import type * as api from '@letta-web/letta-agents-api';
const lettaAgentAPIMock: DeepMockProxy<typeof api> = mockDeep();

jest.mock('@letta-web/letta-agents-api', () => lettaAgentAPIMock);

beforeEach(() => {
  mockReset(lettaAgentAPIMock);
});

export { lettaAgentAPIMock };
