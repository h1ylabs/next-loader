import {
  createBackoff,
  EXPONENTIAL_BACKOFF,
  FIXED_BACKOFF,
  LINEAR_BACKOFF,
  MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
} from "@/lib/features/createBackoff";

describe("createBackoff", () => {
  describe("FIXED_BACKOFF", () => {
    it("should return same delay value", () => {
      expect(FIXED_BACKOFF.next(100)).toBe(100);
      expect(FIXED_BACKOFF.next(500)).toBe(500);
      expect(FIXED_BACKOFF.next(0)).toBe(0);
    });

    it("should have correct type", () => {
      expect(FIXED_BACKOFF.type).toBe("fixed");
    });

    it("should throw error for negative delay", () => {
      expect(() => FIXED_BACKOFF.next(-1)).toThrow(
        MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
      );
    });
  });

  describe("LINEAR_BACKOFF", () => {
    it("should add specified amount to delay", () => {
      const linear = LINEAR_BACKOFF(50);

      expect(linear.next(100)).toBe(150);
      expect(linear.next(200)).toBe(250);
      expect(linear.next(0)).toBe(50);
    });

    it("should handle different add values", () => {
      const linear10 = LINEAR_BACKOFF(10);
      const linear100 = LINEAR_BACKOFF(100);

      expect(linear10.next(5)).toBe(15);
      expect(linear100.next(5)).toBe(105);
    });

    it("should have correct type", () => {
      const linear = LINEAR_BACKOFF(10);
      expect(linear.type).toBe("linear");
    });

    it("should throw error for negative delay", () => {
      const linear = LINEAR_BACKOFF(50);
      expect(() => linear.next(-1)).toThrow(
        MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
      );
    });

    it("should throw error when result becomes negative", () => {
      const linear = LINEAR_BACKOFF(-200);
      expect(() => linear.next(100)).toThrow(
        MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
      );
    });
  });

  describe("EXPONENTIAL_BACKOFF", () => {
    it("should multiply delay by factor", () => {
      const exponential = EXPONENTIAL_BACKOFF(2);

      expect(exponential.next(100)).toBe(200);
      expect(exponential.next(50)).toBe(100);
      expect(exponential.next(1)).toBe(2);
    });

    it("should handle different factors", () => {
      const exponential15 = EXPONENTIAL_BACKOFF(1.5);
      const exponential3 = EXPONENTIAL_BACKOFF(3);

      expect(exponential15.next(100)).toBe(150);
      expect(exponential3.next(10)).toBe(30);
    });

    it("should handle factor of 0", () => {
      const exponential = EXPONENTIAL_BACKOFF(0);
      expect(exponential.next(100)).toBe(0);
    });

    it("should have correct type", () => {
      const exponential = EXPONENTIAL_BACKOFF(2);
      expect(exponential.type).toBe("exponential");
    });

    it("should throw error for negative delay", () => {
      const exponential = EXPONENTIAL_BACKOFF(2);
      expect(() => exponential.next(-1)).toThrow(
        MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
      );
    });

    it("should throw error when result becomes negative", () => {
      const exponential = EXPONENTIAL_BACKOFF(-2);
      expect(() => exponential.next(100)).toThrow(
        MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
      );
    });
  });

  describe("createBackoff", () => {
    it("should create custom backoff strategy", () => {
      const customBackoff = createBackoff("custom", (delay) => delay + 10);

      expect(customBackoff.type).toBe("custom");
      expect(customBackoff.next(50)).toBe(60);
    });

    it("should create backoff with complex logic", () => {
      const complexBackoff = createBackoff("complex", (delay) => {
        if (delay < 100) return delay * 2;
        return delay + 50;
      });

      expect(complexBackoff.type).toBe("complex");
      expect(complexBackoff.next(50)).toBe(100);
      expect(complexBackoff.next(150)).toBe(200);
    });

    it("should validate negative input delay", () => {
      const backoff = createBackoff("test", (delay) => delay);
      expect(() => backoff.next(-5)).toThrow(
        MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
      );
    });

    it("should validate negative result", () => {
      const backoff = createBackoff("test", () => -10);
      expect(() => backoff.next(100)).toThrow(
        MSG_ERR_BACKOFF_RESOLVER_DELAY_NEGATIVE,
      );
    });

    it("should handle zero values correctly", () => {
      const backoff = createBackoff("zero", (delay) => delay);
      expect(backoff.next(0)).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large numbers", () => {
      const exponential = EXPONENTIAL_BACKOFF(2);
      const largeDelay = 1000000;
      expect(exponential.next(largeDelay)).toBe(2000000);
    });

    it("should handle fractional delays", () => {
      const linear = LINEAR_BACKOFF(0.5);
      expect(linear.next(1.5)).toBe(2);
    });

    it("should handle fractional factors", () => {
      const exponential = EXPONENTIAL_BACKOFF(0.5);
      expect(exponential.next(100)).toBe(50);
    });
  });
});
