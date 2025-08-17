/*
 * This file is for things we always want to mock in our tests.
 */

import { TextEncoder, TextDecoder } from 'util';
import * as lodash from 'lodash';

jest.mock('lodash-es', () => {
  return {
    ...lodash,
  };
});

jest.mock('@letta-cloud/config-environment-variables');

jest.mock('nanoid', () => ({
  nanoid: () => `test-nanoid-${Math.random().toString(36).substring(2, 15)}`,
}))


global.TextEncoder = TextEncoder;
// @ts-expect-error - stub
global.TextDecoder = TextDecoder;
