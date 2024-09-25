import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const getFeatureFlagsContract = c.query({
  method: 'GET',
  path: '/feature-flags',
  responses: {
    200: z.any(),
  },
});

export const featureFlagsContracts = c.router({
  getFeatureFlags: getFeatureFlagsContract,
});

export const featureFlagsQueryClientKeys = {
  getFeatureFlags: ['feature-flags'],
};
