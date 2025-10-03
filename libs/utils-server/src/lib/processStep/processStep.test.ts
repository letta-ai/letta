import type { Step } from '@letta-cloud/sdk-core';
import type { PaymentCustomerSubscription } from '@letta-cloud/types';
import { processStepWithSubscription } from './processStep';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';
import { removeCreditsFromOrganization } from '../removeCreditsFromOrganization/removeCreditsFromOrganization';
import { getRedisData } from '@letta-cloud/service-redis';
import {
  getRemainingRecurrentCredits,
  incrementRecurrentCreditUsage,
} from '../recurringCreditsManager/recurringCreditsManager';

// Mock environment configuration
jest.mock('@letta-cloud/config-environment-variables', () => ({
  environment: {
    REDIS_CACHE_TTL: 60,
  },
}));

jest.mock('@letta-cloud/service-email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@letta-cloud/service-clickhouse', () => ({
  trackDailyAgentUsage: jest.fn(),
}));

jest.mock('../getCreditCostPerModel/getCreditCostPerModel');
jest.mock('../removeCreditsFromOrganization/removeCreditsFromOrganization');
jest.mock('@letta-cloud/service-redis');
jest.mock('../recurringCreditsManager/recurringCreditsManager');

const mockGetCreditCostPerModel = getCreditCostPerModel as jest.Mock;
const mockRemoveCreditsFromOrganization =
  removeCreditsFromOrganization as jest.Mock;
const mockGetRedisData = getRedisData as jest.Mock;
const mockGetRemainingRecurrentCredits =
  getRemainingRecurrentCredits as jest.Mock;
const mockIncrementRecurrentCreditUsage =
  incrementRecurrentCreditUsage as jest.Mock;

describe('processStepWithSubscription', () => {
  const mockStep: Step = {
    id: 'step-123',
    model: 'gpt-4',
    model_endpoint: 'https://api.openai.com/v1',
    context_window_limit: 8192,
    organization_id: 'org-456',
  } as Step;

  const mockSubscription: PaymentCustomerSubscription = {
    tier: 'pro',
    billingPeriodStart: '2025-01-01T00:00:00Z',
    billingPeriodEnd: '2025-02-01T00:00:00Z',
  } as PaymentCustomerSubscription;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockGetCreditCostPerModel.mockResolvedValue(100);
    mockGetRedisData.mockResolvedValue({ modelId: 'model-789' });
    mockGetRemainingRecurrentCredits.mockResolvedValue(50);
    mockIncrementRecurrentCreditUsage.mockResolvedValue(undefined);
    mockRemoveCreditsFromOrganization.mockResolvedValue({
      newCredits: '1000',
      transactionId: 'txn-123',
    });
  });

  describe('validation', () => {
    it('should return null if model is missing', async () => {
      const invalidStep = { ...mockStep, model: undefined };
      const result = await processStepWithSubscription(
        invalidStep as Step,
        mockSubscription,
        'org-456',
      );
      expect(result).toBeNull();
    });

    it('should return null if model_endpoint is missing', async () => {
      const invalidStep = { ...mockStep, model_endpoint: undefined };
      const result = await processStepWithSubscription(
        invalidStep as Step,
        mockSubscription,
        'org-456',
      );
      expect(result).toBeNull();
    });

    it('should return null if context_window_limit is missing', async () => {
      const invalidStep = { ...mockStep, context_window_limit: undefined };
      const result = await processStepWithSubscription(
        invalidStep as Step,
        mockSubscription,
        'org-456',
      );
      expect(result).toBeNull();
    });

    it('should return null if organization_id is missing', async () => {
      const invalidStep = { ...mockStep, organization_id: undefined };
      const result = await processStepWithSubscription(
        invalidStep as Step,
        mockSubscription,
        'org-456',
      );
      expect(result).toBeNull();
    });
  });

  describe('credit cost calculation', () => {
    it('should return null if credit cost is not a number', async () => {
      mockGetCreditCostPerModel.mockResolvedValue('invalid');

      const result = await processStepWithSubscription(
        mockStep,
        mockSubscription,
        'org-456',
      );

      expect(result).toBeNull();
    });

    it('should fetch credit cost with correct parameters', async () => {
      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockGetCreditCostPerModel).toHaveBeenCalledWith({
        modelName: 'gpt-4',
        modelEndpoint: 'https://api.openai.com/v1',
        contextWindowSize: 8192,
      });
    });

    it('should fetch model data from redis', async () => {
      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockGetRedisData).toHaveBeenCalledWith(
        'modelNameAndEndpointToIdMap',
        {
          modelName: 'gpt-4',
          modelEndpoint: 'https://api.openai.com/v1',
        },
      );
    });
  });

  describe('recurrent credit handling', () => {
    it('should use recurrent credits when available and sufficient', async () => {
      mockGetCreditCostPerModel.mockResolvedValue(50);
      mockGetRemainingRecurrentCredits.mockResolvedValue(100);

      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockIncrementRecurrentCreditUsage).toHaveBeenCalledWith(
        'org-456',
        mockSubscription,
        50,
      );

      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith({
        amount: 0,
        coreOrganizationId: 'org-456',
        source: 'inference',
        trueCost: 50,
        stepId: 'step-123',
        modelTier: 'per-inference',
        modelId: 'model-789',
        note: 'Deducted 50 recurrent and 0 additional credits for model gpt-4',
      });
    });

    it('should use partial recurrent credits when insufficient', async () => {
      mockGetCreditCostPerModel.mockResolvedValue(100);
      mockGetRemainingRecurrentCredits.mockResolvedValue(30);

      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockIncrementRecurrentCreditUsage).toHaveBeenCalledWith(
        'org-456',
        mockSubscription,
        30,
      );

      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith({
        amount: 70,
        coreOrganizationId: 'org-456',
        source: 'inference',
        trueCost: 100,
        stepId: 'step-123',
        modelTier: 'per-inference',
        modelId: 'model-789',
        note: 'Deducted 30 recurrent and 70 additional credits for model gpt-4',
      });
    });

    it('should not increment recurrent credits when none are available', async () => {
      mockGetCreditCostPerModel.mockResolvedValue(100);
      mockGetRemainingRecurrentCredits.mockResolvedValue(0);

      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockIncrementRecurrentCreditUsage).not.toHaveBeenCalled();

      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith({
        amount: 100,
        coreOrganizationId: 'org-456',
        source: 'inference',
        trueCost: 100,
        stepId: 'step-123',
        modelTier: 'per-inference',
        modelId: 'model-789',
        note: 'Deducted 0 recurrent and 100 additional credits for model gpt-4',
      });
    });

    it('should not increment recurrent credits when remaining credits are 0', async () => {
      mockGetCreditCostPerModel.mockResolvedValue(50);
      mockGetRemainingRecurrentCredits.mockResolvedValue(0);

      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockIncrementRecurrentCreditUsage).not.toHaveBeenCalled();
    });
  });

  describe('credit deduction', () => {
    it('should call removeCreditsFromOrganization with correct parameters', async () => {
      mockGetCreditCostPerModel.mockResolvedValue(100);
      mockGetRemainingRecurrentCredits.mockResolvedValue(40);

      const result = await processStepWithSubscription(
        mockStep,
        mockSubscription,
        'org-456',
      );

      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith({
        amount: 60,
        coreOrganizationId: 'org-456',
        source: 'inference',
        trueCost: 100,
        stepId: 'step-123',
        modelTier: 'per-inference',
        modelId: 'model-789',
        note: 'Deducted 40 recurrent and 60 additional credits for model gpt-4',
      });

      expect(result).toEqual({
        newCredits: '1000',
        transactionId: 'txn-123',
      });
    });

    it('should always set modelTier to per-inference', async () => {
      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          modelTier: 'per-inference',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should return null and log error when removeCreditsFromOrganization fails', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockRemoveCreditsFromOrganization.mockRejectedValue(
        new Error('Failed to remove credits'),
      );

      const result = await processStepWithSubscription(
        mockStep,
        mockSubscription,
        'org-456',
      );

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to deduct credits from organization org-456 for model gpt-4',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should return null and log error when incrementRecurrentCreditUsage fails', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetRemainingRecurrentCredits.mockResolvedValue(50);
      mockIncrementRecurrentCreditUsage.mockRejectedValue(
        new Error('Failed to increment'),
      );

      const result = await processStepWithSubscription(
        mockStep,
        mockSubscription,
        'org-456',
      );

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to deduct credits from organization org-456 for model gpt-4',
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle model data being null', async () => {
      mockGetRedisData.mockResolvedValue(null);

      const result = await processStepWithSubscription(
        mockStep,
        mockSubscription,
        'org-456',
      );

      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: undefined,
        }),
      );
      expect(result).toBeTruthy();
    });

    it('should handle credit cost of 0 and not deduct credits', async () => {
      mockGetCreditCostPerModel.mockResolvedValue(0);
      mockGetRemainingRecurrentCredits.mockResolvedValue(50);

      const result = await processStepWithSubscription(
        mockStep,
        mockSubscription,
        'org-456',
      );

      expect(mockIncrementRecurrentCreditUsage).not.toHaveBeenCalled();
      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0,
          trueCost: 0,
        }),
      );
      expect(result).toBeTruthy();
    });

    it('should handle exact match between credit cost and remaining recurrent credits', async () => {
      mockGetCreditCostPerModel.mockResolvedValue(100);
      mockGetRemainingRecurrentCredits.mockResolvedValue(100);

      await processStepWithSubscription(mockStep, mockSubscription, 'org-456');

      expect(mockIncrementRecurrentCreditUsage).toHaveBeenCalledWith(
        'org-456',
        mockSubscription,
        100,
      );

      expect(mockRemoveCreditsFromOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0,
          trueCost: 100,
        }),
      );
    });
  });
});
