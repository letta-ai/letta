import axios from 'axios';
import * as process from 'node:process';

export const BASE_URL = 'http://localhost:3000';

export const lettaAxiosSDK = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true,
});

export const TEST_STAGE: 'branch' | 'main' = process.env.TEST_STAGE as
  | 'branch'
  | 'main';
