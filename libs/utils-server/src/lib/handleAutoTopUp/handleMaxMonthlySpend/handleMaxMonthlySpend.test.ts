import { canAutoTopUpWithinMonthlyLimit } from './handleMaxMonthlySpend';
import { db } from '@letta-cloud/service-database';

// Mock dependencies
jest.mock('@letta-cloud/service-database', () => ({
  db: {
    select: jest.fn(),
  },
  organizationCreditTransactions: {
    organizationId: 'organization_id',
    source: 'source',
    transactionType: 'transaction_type',
    createdAt: 'created_at',
    amount: 'amount',
  },
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('canAutoTopUpWithinMonthlyLimit', () => {
  const organizationId = 'org-123';
  const refillAmount = 5000;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console logs in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when maxMonthlySpend is null or undefined', () => {
    it('should allow top-up when maxMonthlySpend is null', async () => {
      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: null,
        refillAmount,
      });

      expect(result).toEqual({
        canTopUp: true,
        currentMonthlySpend: 0,
        remainingBudget: Infinity,
      });
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should allow top-up when maxMonthlySpend is undefined', async () => {
      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: undefined as any,
        refillAmount,
      });

      expect(result).toEqual({
        canTopUp: true,
        currentMonthlySpend: 0,
        remainingBudget: Infinity,
      });
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe('when maxMonthlySpend is set', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '0' }]),
        }),
      } as any);
    });

    it('should allow top-up when no spending has occurred this month', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '0' }]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result).toEqual({
        canTopUp: true,
        currentMonthlySpend: 0,
        remainingBudget: 10000,
      });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should allow top-up when current spend + refill is within limit', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '3000' }]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result).toEqual({
        canTopUp: true,
        currentMonthlySpend: 3000,
        remainingBudget: 7000,
      });
    });

    it('should allow top-up when current spend + refill equals limit exactly', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '5000' }]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result).toEqual({
        canTopUp: true,
        currentMonthlySpend: 5000,
        remainingBudget: 5000,
      });
    });

    it('should block top-up when current spend + refill exceeds limit', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '6000' }]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result.canTopUp).toBe(false);
      expect(result.currentMonthlySpend).toBe(6000);
      expect(result.remainingBudget).toBe(4000);
      expect(result.reason).toContain('exceed monthly limit');
      expect(result.reason).toContain('6000');
      expect(result.reason).toContain('10000');
    });

    it('should block top-up when already at limit', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '10000' }]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result.canTopUp).toBe(false);
      expect(result.currentMonthlySpend).toBe(10000);
      expect(result.remainingBudget).toBe(0);
    });

    it('should handle decimal amounts correctly', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '2500.50' }]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result.canTopUp).toBe(true);
      expect(result.currentMonthlySpend).toBe(2500.50);
      expect(result.remainingBudget).toBe(7499.50);
    });

    it('should handle missing totalSpend in result', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{}]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result.canTopUp).toBe(true);
      expect(result.currentMonthlySpend).toBe(0);
    });

    it('should handle empty result array', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result.canTopUp).toBe(true);
      expect(result.currentMonthlySpend).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should fail open (allow top-up) when database query throws error', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('Database connection error')),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result.canTopUp).toBe(true);
      expect(result.currentMonthlySpend).toBe(0);
      expect(result.remainingBudget).toBe(10000);
      expect(result.reason).toContain('Error checking limit');
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle null response from database', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(null as any),
        }),
      } as any);

      const result = await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(result.canTopUp).toBe(true);
      expect(result.currentMonthlySpend).toBe(0);
    });
  });

  describe('logging', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '3000' }]),
        }),
      } as any);
    });

    it('should log when checking monthly spend', async () => {
      await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[MaxMonthlySpend] Checking auto top-up spend'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`Organization ${organizationId} has spent`),
      );
    });

    it('should log when top-up is allowed', async () => {
      await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Auto top-up allowed'),
      );
    });

    it('should log when top-up is blocked', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ totalSpend: '8000' }]),
        }),
      } as any);

      await canAutoTopUpWithinMonthlyLimit({
        organizationId,
        maxMonthlySpend: 10000,
        refillAmount: 5000,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Auto top-up blocked'),
      );
    });
  });
});
