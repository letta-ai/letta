import {
  SCALE_PLAN_IDS,
  PRO_PLAN_PRICE_IDS,
  SCALE_PLAN_PRODUCT_IDS,
  LEGACY_PRO_PLAN_PRODUCT_IDS,
} from './constants';

describe('Payment Constants', () => {
  describe('SCALE_PLAN_IDS', () => {
    it('should contain valid stripe price IDs', () => {
      expect(SCALE_PLAN_IDS).toHaveLength(2);
      expect(SCALE_PLAN_IDS).toContain('price_1ROscyIITVhFnB4W6rts94la');
      expect(SCALE_PLAN_IDS).toContain('price_1ROVADIITVhFnB4WsINYfPF6');
    });

    it('should contain only string values', () => {
      SCALE_PLAN_IDS.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id).toBeTruthy();
      });
    });

    it('should contain valid stripe price ID format', () => {
      SCALE_PLAN_IDS.forEach((id) => {
        expect(id).toMatch(/^price_[A-Za-z0-9]+$/);
      });
    });
  });

  describe('PRO_PLAN_PRICE_IDS', () => {
    it('should contain valid stripe price IDs', () => {
      expect(PRO_PLAN_PRICE_IDS).toHaveLength(2);
      expect(PRO_PLAN_PRICE_IDS).toContain('price_1RH71QIITVhFnB4W94dbGkOr');
      expect(PRO_PLAN_PRICE_IDS).toContain('price_1RH6z1IITVhFnB4Wya5Ln5fy');
    });

    it('should contain only string values', () => {
      PRO_PLAN_PRICE_IDS.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id).toBeTruthy();
      });
    });

    it('should contain valid stripe price ID format', () => {
      PRO_PLAN_PRICE_IDS.forEach((id) => {
        expect(id).toMatch(/^price_[A-Za-z0-9]+$/);
      });
    });
  });

  describe('SCALE_PLAN_PRODUCT_IDS', () => {
    it('should contain valid stripe product IDs', () => {
      expect(SCALE_PLAN_PRODUCT_IDS).toHaveLength(2);
      expect(SCALE_PLAN_PRODUCT_IDS).toContain('prod_SJVepPz2UNwINZ');
      expect(SCALE_PLAN_PRODUCT_IDS).toContain('prod_SJ7PCALsx1uv67');
    });

    it('should contain only string values', () => {
      SCALE_PLAN_PRODUCT_IDS.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id).toBeTruthy();
      });
    });

    it('should contain valid stripe product ID format', () => {
      SCALE_PLAN_PRODUCT_IDS.forEach((id) => {
        expect(id).toMatch(/^prod_[A-Za-z0-9]+$/);
      });
    });
  });

  describe('PRO_PLAN_PRODUCT_IDS', () => {
    it('should contain valid stripe product IDs', () => {
      expect(LEGACY_PRO_PLAN_PRODUCT_IDS).toHaveLength(2);
      expect(LEGACY_PRO_PLAN_PRODUCT_IDS).toContain('prod_SBTwGZfXZVdEah');
      expect(LEGACY_PRO_PLAN_PRODUCT_IDS).toContain('prod_SBTziQ1oxYLnNc');
    });

    it('should contain only string values', () => {
      LEGACY_PRO_PLAN_PRODUCT_IDS.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id).toBeTruthy();
      });
    });

    it('should contain valid stripe product ID format', () => {
      LEGACY_PRO_PLAN_PRODUCT_IDS.forEach((id) => {
        expect(id).toMatch(/^prod_[A-Za-z0-9]+$/);
      });
    });
  });

  describe('Price and Product ID relationships', () => {
    it('should have matching number of price and product IDs for scale plan', () => {
      expect(SCALE_PLAN_IDS).toHaveLength(SCALE_PLAN_PRODUCT_IDS.length);
    });

    it('should have matching number of price and product IDs for pro plan', () => {
      expect(PRO_PLAN_PRICE_IDS).toHaveLength(LEGACY_PRO_PLAN_PRODUCT_IDS.length);
    });

    it('should not have overlapping IDs between different plan types', () => {
      const allPriceIds = [...SCALE_PLAN_IDS, ...PRO_PLAN_PRICE_IDS];
      const allProductIds = [
        ...SCALE_PLAN_PRODUCT_IDS,
        ...LEGACY_PRO_PLAN_PRODUCT_IDS,
      ];

      expect(new Set(allPriceIds).size).toBe(allPriceIds.length);
      expect(new Set(allProductIds).size).toBe(allProductIds.length);
    });
  });
});
