/*
 * This file is for things we always want to mock in our tests.
 */

import { TextEncoder, TextDecoder } from 'util';

jest.mock('@letta-cloud/environmental-variables');

global.TextEncoder = TextEncoder;
// @ts-expect-error - stub
global.TextDecoder = TextDecoder;
