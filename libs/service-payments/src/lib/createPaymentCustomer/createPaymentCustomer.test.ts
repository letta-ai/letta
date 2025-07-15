import { createPaymentCustomer } from './createPaymentCustomer';
import { getStripeClient } from '../getStripeClient/getStripeClient';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';

jest.mock('../getStripeClient/getStripeClient');
jest.mock('@letta-cloud/service-database', () => ({
  db: {
    update: jest.fn(),
  },
  organizationBillingDetails: {},
}));
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));

const mockGetStripeClient = getStripeClient as jest.MockedFunction<
  typeof getStripeClient
>;

describe('createPaymentCustomer', () => {
  const mockStripeClient = {
    customers: {
      search: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockPayload = {
    organizationId: 'org-123',
    name: 'Test Organization',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStripeClient.mockReturnValue(mockStripeClient as any);
  });

  it('should return existing customer if found', async () => {
    const existingCustomer = { id: 'cus_123', email: 'test@example.com' };
    mockStripeClient.customers.search.mockResolvedValue({
      data: [existingCustomer],
    });

    const mockUpdate = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    (db.update as jest.Mock).mockReturnValue(mockUpdate);

    const result = await createPaymentCustomer(mockPayload);

    expect(mockStripeClient.customers.search).toHaveBeenCalledWith({
      query: `metadata["organizationId"]:"org-123"`,
      limit: 1,
    });
    expect(db.update).toHaveBeenCalledWith(organizationBillingDetails);
    expect(result).toEqual(existingCustomer);
  });

  it('should create new customer if not found', async () => {
    const newCustomer = { id: 'cus_456', email: 'test@example.com' };
    mockStripeClient.customers.search.mockResolvedValue({
      data: [],
    });
    mockStripeClient.customers.create.mockResolvedValue(newCustomer);

    const result = await createPaymentCustomer(mockPayload);

    expect(mockStripeClient.customers.search).toHaveBeenCalledWith({
      query: `metadata["organizationId"]:"org-123"`,
      limit: 1,
    });
    expect(mockStripeClient.customers.create).toHaveBeenCalledWith(
      {
        name: 'Test Organization',
        email: 'test@example.com',
        metadata: {
          organizationId: 'org-123',
        },
      },
      {
        idempotencyKey: 'org-123',
      },
    );
    expect(result).toEqual(newCustomer);
  });

  it('should handle stripe client errors', async () => {
    mockStripeClient.customers.search.mockRejectedValue(
      new Error('Stripe API error'),
    );

    await expect(createPaymentCustomer(mockPayload)).rejects.toThrow(
      'Stripe API error',
    );
  });
});
