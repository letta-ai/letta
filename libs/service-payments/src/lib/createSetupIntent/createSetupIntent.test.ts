import { createSetupIntent } from './createSetupIntent';

// Mock all external dependencies
jest.mock('../getStripeClient/getStripeClient', () => ({
  getStripeClient: jest.fn(),
}));

jest.mock('../getPaymentCustomer/getPaymentCustomer', () => ({
  getPaymentCustomer: jest.fn(),
}));

const mockGetStripeClient =
  require('../getStripeClient/getStripeClient').getStripeClient;
const mockGetPaymentCustomer =
  require('../getPaymentCustomer/getPaymentCustomer').getPaymentCustomer;

describe('createSetupIntent', () => {
  const mockStripeClient = {
    setupIntents: {
      create: jest.fn(),
    },
  };

  const organizationId = 'org-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStripeClient.mockReturnValue(mockStripeClient);
    mockGetPaymentCustomer.mockResolvedValue({
      id: 'cus_123',
      defaultPaymentMethod: 'pm_123',
    });
  });

  it('should create setup intent successfully', async () => {
    const mockSetupIntent = {
      id: 'seti_123',
      client_secret: 'seti_123_secret',
      status: 'requires_payment_method',
    };
    mockStripeClient.setupIntents.create.mockResolvedValue(mockSetupIntent);

    const result = await createSetupIntent({ organizationId });

    expect(mockGetPaymentCustomer).toHaveBeenCalledWith(organizationId);
    expect(mockStripeClient.setupIntents.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      payment_method_types: ['card'],
    });
    expect(result).toEqual(mockSetupIntent);
  });

  it('should return null when customer is not found', async () => {
    mockGetPaymentCustomer.mockResolvedValue(null);

    const result = await createSetupIntent({ organizationId });

    expect(result).toBeNull();
    expect(mockStripeClient.setupIntents.create).not.toHaveBeenCalled();
  });

  it('should return null when stripe client is not available', async () => {
    mockGetStripeClient.mockReturnValue(null);

    const result = await createSetupIntent({ organizationId });

    expect(result).toBeNull();
    expect(mockStripeClient.setupIntents.create).not.toHaveBeenCalled();
  });

  it('should handle stripe setup intent creation errors', async () => {
    mockStripeClient.setupIntents.create.mockRejectedValue(
      new Error('Setup intent creation failed'),
    );

    await expect(createSetupIntent({ organizationId })).rejects.toThrow(
      'Setup intent creation failed',
    );
  });
});
