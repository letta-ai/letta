import { getStripeClient } from './getStripeClient';

describe('getStripeClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return a Stripe client when STRIPE_SECRET_KEY is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';

    const client = getStripeClient();

    expect(client).toBeDefined();
    expect(client).toHaveProperty('customers');
    expect(client).toHaveProperty('subscriptions');
  });

  it('should throw an error when STRIPE_SECRET_KEY is not set', () => {
    delete process.env.STRIPE_SECRET_KEY;

    expect(() => getStripeClient()).toThrow(
      'Stripe secret key not found, please add it via just env',
    );
  });

  it('should throw error when STRIPE_SECRET_KEY is empty string', () => {
    process.env.STRIPE_SECRET_KEY = '';

    expect(() => getStripeClient()).toThrow(
      'Stripe secret key not found, please add it via just env',
    );
  });
});
