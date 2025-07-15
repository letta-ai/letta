import { createPayment } from './createPayment';

// Mock all external dependencies
jest.mock('../getStripeClient/getStripeClient', () => ({
  getStripeClient: jest.fn(),
}));

jest.mock('../getPaymentCustomer/getPaymentCustomer', () => ({
  getPaymentCustomer: jest.fn(),
}));

jest.mock('@letta-cloud/service-email', () => ({
  getDefaultContactEmails: jest.fn(),
}));

const mockGetStripeClient =
  require('../getStripeClient/getStripeClient').getStripeClient;
const mockGetPaymentCustomer =
  require('../getPaymentCustomer/getPaymentCustomer').getPaymentCustomer;
const mockGetDefaultContactEmails =
  require('@letta-cloud/service-email').getDefaultContactEmails;

describe('createPayment', () => {
  const mockStripeClient = {
    paymentIntents: {
      create: jest.fn(),
    },
  };

  const mockPayload = {
    organizationId: 'org-123',
    amountInCents: 5000,
    cardId: 'pm_123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStripeClient.mockReturnValue(mockStripeClient);
    mockGetPaymentCustomer.mockResolvedValue({
      id: 'cus_123',
      defaultPaymentMethod: 'pm_default',
    });
    mockGetDefaultContactEmails.mockResolvedValue(['test@example.com']);
  });

  it('should create payment intent successfully', async () => {
    const mockPaymentIntent = {
      id: 'pi_123',
      amount: 5000,
      currency: 'usd',
      status: 'succeeded',
    };
    mockStripeClient.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

    const result = await createPayment(mockPayload);

    expect(mockGetPaymentCustomer).toHaveBeenCalledWith('org-123');
    expect(mockGetDefaultContactEmails).toHaveBeenCalledWith({
      organizationId: 'org-123',
    });
    expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith({
      amount: 5000,
      currency: 'usd',
      confirm: true,
      customer: 'cus_123',
      payment_method: 'pm_123',
      receipt_email: 'test@example.com',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });
    expect(result).toEqual(mockPaymentIntent);
  });

  it('should throw error when customer is not found', async () => {
    mockGetPaymentCustomer.mockResolvedValue(null);

    await expect(createPayment(mockPayload)).rejects.toThrow(
      'Failed to get customer',
    );
  });

  it('should handle stripe payment intent creation errors', async () => {
    mockStripeClient.paymentIntents.create.mockRejectedValue(
      new Error('Payment failed'),
    );

    await expect(createPayment(mockPayload)).rejects.toThrow('Payment failed');
  });
});
