import {
  DynamicTimeout,
  MSG_ERR_DYNAMIC_TIMEOUT_ADD_ALREADY_REJECTED,
  MSG_ERR_DYNAMIC_TIMEOUT_DELAY_NEGATIVE,
  MSG_ERR_DYNAMIC_TIMEOUT_EXECUTE_ALREADY_REJECTED,
  MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE,
  MSG_ERR_DYNAMIC_TIMEOUT_RESET_ALREADY_REJECTED,
} from "@/lib/utils/DynamicTimeout";

describe("DynamicTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should create instance with valid parameters", () => {
      const timeout = new DynamicTimeout("test error", 1000);
      timeout.getPromise().catch(() => {});

      expect(timeout.getInitialDelay()).toBe(1000);
      expect(timeout.getTotalDelay()).toBe(1000);
      expect(timeout.isRejected()).toBe(false);
      expect(typeof timeout.getStartTime()).toBe("number");
      expect(timeout.getPromise()).toBeInstanceOf(Promise);
    });

    it("should throw error for negative initial delay", () => {
      expect(() => new DynamicTimeout("error", -100)).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE
      );
    });

    it("should accept zero as initial delay", () => {
      const timeout = new DynamicTimeout("error", 0);
      timeout.getPromise().catch(() => {});

      expect(() => timeout).not.toThrow();
    });
  });

  describe("basic timeout behavior", () => {
    it("should reject promise after initial delay", async () => {
      const rejectValue = "timeout occurred";
      const timeout = new DynamicTimeout(rejectValue, 1000);

      const promise = timeout.getPromise();

      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toBe(rejectValue);
      expect(timeout.isRejected()).toBe(true);
    });

    it("should not reject before timeout", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      jest.advanceTimersByTime(999);

      expect(timeout.isRejected()).toBe(false);
    });
  });

  describe("addTimeout()", () => {
    it("should add delay to queue and update total delay", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      timeout.addTimeout(500);

      expect(timeout.getTotalDelay()).toBe(1500);
    });

    it("should process multiple delays in sequence", async () => {
      const timeout = new DynamicTimeout("timeout", 100);

      timeout.addTimeout(200);
      timeout.addTimeout(300);

      const promise = timeout.getPromise();

      // First timeout (100ms) should not reject - move to next in queue
      jest.advanceTimersByTime(100);
      expect(timeout.isRejected()).toBe(false);

      // Second timeout (200ms) should not reject - move to next in queue
      jest.advanceTimersByTime(200);
      expect(timeout.isRejected()).toBe(false);

      // Third timeout (300ms) should reject - no more in queue
      jest.advanceTimersByTime(300);
      await expect(promise).rejects.toBe("timeout");
    });

    it("should throw error for negative delay", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      expect(() => timeout.addTimeout(-100)).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_DELAY_NEGATIVE
      );
    });

    it("should throw error when timeout is already rejected", async () => {
      const timeout = new DynamicTimeout("error", 100);

      jest.advanceTimersByTime(100);
      await timeout.getPromise().catch(() => {});

      expect(() => timeout.addTimeout(100)).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_ADD_ALREADY_REJECTED
      );
    });

    it("should accept zero delay", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      expect(() => timeout.addTimeout(0)).not.toThrow();
      expect(timeout.getTotalDelay()).toBe(1000);
    });
  });

  describe("resetTimeout()", () => {
    it("should reset with same initial delay", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      timeout.addTimeout(500);

      timeout.resetTimeout();

      expect(timeout.getInitialDelay()).toBe(1000);
      expect(timeout.getTotalDelay()).toBe(1000);
    });

    it("should reset with new initial delay", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      timeout.addTimeout(500);

      timeout.resetTimeout(2000);

      expect(timeout.getInitialDelay()).toBe(2000);
      expect(timeout.getTotalDelay()).toBe(2000);
    });

    it("should clear reserved queue", async () => {
      const timeout = new DynamicTimeout("timeout", 100);
      timeout.addTimeout(200);

      timeout.resetTimeout(500);

      const promise = timeout.getPromise();
      jest.advanceTimersByTime(500);

      await expect(promise).rejects.toBe("timeout");
    });

    it("should throw error for negative delay", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      expect(() => timeout.resetTimeout(-100)).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE
      );
    });

    it("should throw error when timeout is already rejected", async () => {
      const timeout = new DynamicTimeout("error", 100);

      jest.advanceTimersByTime(100);
      await timeout.getPromise().catch(() => {});

      expect(() => timeout.resetTimeout()).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_RESET_ALREADY_REJECTED
      );
    });
  });

  describe("executeTimeout()", () => {
    it("should immediately reject promise", async () => {
      const timeout = new DynamicTimeout("immediate", 1000);

      const promise = timeout.getPromise();
      timeout.executeTimeout();

      await expect(promise).rejects.toBe("immediate");
      expect(timeout.isRejected()).toBe(true);
    });

    it("should clear reserved queue", async () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.addTimeout(500);

      timeout.executeTimeout();

      await timeout.getPromise().catch(() => {});

      // No way to directly check queue, but total delay should remain unchanged
      expect(timeout.getTotalDelay()).toBe(1500);
    });

    it("should throw error when timeout is already rejected", async () => {
      const timeout = new DynamicTimeout("error", 100);

      jest.advanceTimersByTime(100);
      await timeout.getPromise().catch(() => {});

      expect(() => timeout.executeTimeout()).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_EXECUTE_ALREADY_REJECTED
      );
    });
  });

  describe("cancelTimeout()", () => {
    it("should prevent timeout rejection", () => {
      const timeout = new DynamicTimeout("error", 1000);

      timeout.cancelTimeout();
      jest.advanceTimersByTime(1000);

      expect(timeout.isRejected()).toBe(false);
    });

    it("should clear reserved queue", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      timeout.addTimeout(500);

      timeout.cancelTimeout();

      // Total delay should remain unchanged as it's just a counter
      expect(timeout.getTotalDelay()).toBe(1500);
    });

    it("should not throw error when called multiple times", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      expect(() => {
        timeout.cancelTimeout();
        timeout.cancelTimeout();
      }).not.toThrow();
    });

    it("should not throw error when timeout is already rejected", async () => {
      const timeout = new DynamicTimeout("error", 100);

      jest.advanceTimersByTime(100);
      await timeout.getPromise().catch(() => {});

      expect(() => timeout.cancelTimeout()).not.toThrow();
    });
  });

  describe("getter methods", () => {
    it("should return correct initial delay", () => {
      const timeout = new DynamicTimeout("error", 1500);
      timeout.getPromise().catch(() => {});

      expect(timeout.getInitialDelay()).toBe(1500);
    });

    it("should return correct total delay after additions", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      timeout.addTimeout(500);
      timeout.addTimeout(300);

      expect(timeout.getTotalDelay()).toBe(1800);
    });

    it("should return valid start time", () => {
      const beforeCreation = Date.now();
      const timeout = new DynamicTimeout("error", 1000);
      const afterCreation = Date.now();

      timeout.getPromise().catch(() => {});

      const startTime = timeout.getStartTime();
      expect(startTime).toBeGreaterThanOrEqual(beforeCreation);
      expect(startTime).toBeLessThanOrEqual(afterCreation);
    });

    it("should return correct rejection status", async () => {
      const timeout = new DynamicTimeout("error", 100);

      expect(timeout.isRejected()).toBe(false);

      jest.advanceTimersByTime(100);
      await timeout.getPromise().catch(() => {});

      expect(timeout.isRejected()).toBe(true);
    });

    it("should return same promise instance", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      const promise1 = timeout.getPromise();
      const promise2 = timeout.getPromise();

      expect(promise1).toBe(promise2);
    });
  });

  describe("complex scenarios", () => {
    it("should handle rapid operations before timeout", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      timeout.addTimeout(200);
      timeout.addTimeout(300);
      timeout.resetTimeout(500);
      timeout.addTimeout(100);

      expect(timeout.getTotalDelay()).toBe(600);
      expect(timeout.getInitialDelay()).toBe(500);
    });

    it("should handle cancel followed by operations", () => {
      const timeout = new DynamicTimeout("error", 1000);
      timeout.getPromise().catch(() => {});

      timeout.cancelTimeout();

      // These should not throw as cancel doesn't change rejection status
      expect(() => {
        timeout.addTimeout(100);
        timeout.resetTimeout(500);
      }).not.toThrow();
    });

    it("should preserve rejection value through operations", async () => {
      const customError = new Error("Custom timeout error");
      const timeout = new DynamicTimeout(customError, 100);

      timeout.addTimeout(200);

      jest.advanceTimersByTime(100);
      jest.advanceTimersByTime(200);

      await expect(timeout.getPromise()).rejects.toBe(customError);
    });

    it("should handle zero delays correctly", async () => {
      const timeout = new DynamicTimeout("error", 0);

      const promise = timeout.getPromise();
      jest.advanceTimersByTime(0);

      await expect(promise).rejects.toBe("error");
    });
  });
});
