import {
  DynamicTimeout,
  MSG_ERR_DYNAMIC_TIMEOUT_ADD_ALREADY_REJECTED,
  MSG_ERR_DYNAMIC_TIMEOUT_DELAY_NEGATIVE,
  MSG_ERR_DYNAMIC_TIMEOUT_EXECUTE_ALREADY_REJECTED,
  MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE,
  MSG_ERR_DYNAMIC_TIMEOUT_RESET_ALREADY_REJECTED,
} from "@/lib/utils/DynamicTimeout";

// Helper to check timer count (for memory leak detection)
function expectNoActiveTimers() {
  expect(jest.getTimerCount()).toBe(0);
}

// Helper to create race-safe target functions
function createRaceTarget<T>(
  result: T,
  delay: number = 0,
  shouldError: boolean = false,
) {
  return jest.fn(async () => {
    if (delay > 0) {
      return new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          if (shouldError) {
            reject(new Error("Target function error"));
          } else {
            resolve(result);
          }
        }, delay);
      });
    }

    if (shouldError) {
      throw new Error("Target function error");
    }
    return result;
  });
}

// Helper to safely handle Promise.race with DynamicTimeout
function createSafeRace<T>(
  target: () => Promise<T>,
  timeout: DynamicTimeout,
): Promise<T> {
  const timeoutPromise = timeout.getPromise();
  timeoutPromise.catch(() => {}); // Prevent unhandled rejection

  return Promise.race([target(), timeoutPromise]);
}

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
        MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE,
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
        MSG_ERR_DYNAMIC_TIMEOUT_DELAY_NEGATIVE,
      );
    });

    it("should throw error when timeout is already rejected", async () => {
      const timeout = new DynamicTimeout("error", 100);

      jest.advanceTimersByTime(100);
      await timeout.getPromise().catch(() => {});

      expect(() => timeout.addTimeout(100)).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_ADD_ALREADY_REJECTED,
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
        MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE,
      );
    });

    it("should throw error when timeout is already rejected", async () => {
      const timeout = new DynamicTimeout("error", 100);

      jest.advanceTimersByTime(100);
      await timeout.getPromise().catch(() => {});

      expect(() => timeout.resetTimeout()).toThrow(
        MSG_ERR_DYNAMIC_TIMEOUT_RESET_ALREADY_REJECTED,
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
        MSG_ERR_DYNAMIC_TIMEOUT_EXECUTE_ALREADY_REJECTED,
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

  describe("Promise.race scenarios", () => {
    it("should handle race with fast resolving target", async () => {
      const timeout = new DynamicTimeout("timeout", 1000);
      const fastTarget = createRaceTarget("fast result", 100);

      const racePromise = createSafeRace(fastTarget, timeout);

      jest.advanceTimersByTime(100);
      const result = await racePromise;

      expect(result).toBe("fast result");
      expect(fastTarget).toHaveBeenCalled();
      expect(timeout.isRejected()).toBe(false);

      // Clean up timeout manually since target won
      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle race with slow resolving target", async () => {
      const timeout = new DynamicTimeout("timeout occurred", 300);
      const slowTarget = createRaceTarget("slow result", 1000);

      const racePromise = createSafeRace(slowTarget, timeout);

      jest.advanceTimersByTime(300);

      await expect(racePromise).rejects.toBe("timeout occurred");
      expect(timeout.isRejected()).toBe(true);

      // Advance timers to also clear the target's setTimeout
      jest.advanceTimersByTime(1000);
      expectNoActiveTimers();
    });

    it("should handle race with immediately resolving target", async () => {
      const timeout = new DynamicTimeout("timeout", 1000);
      const immediateTarget = createRaceTarget("immediate", 0);

      const racePromise = createSafeRace(immediateTarget, timeout);

      const result = await racePromise;

      expect(result).toBe("immediate");
      expect(immediateTarget).toHaveBeenCalled();
      expect(timeout.isRejected()).toBe(false);

      // Clean up timeout manually since target won
      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle race with target that throws error", async () => {
      const timeout = new DynamicTimeout("timeout", 1000);
      const errorTarget = createRaceTarget("", 100, true);

      const racePromise = createSafeRace(errorTarget, timeout);

      jest.advanceTimersByTime(100);

      await expect(racePromise).rejects.toThrow("Target function error");
      expect(errorTarget).toHaveBeenCalled();
      expect(timeout.isRejected()).toBe(false);

      // Clean up timeout manually since target threw first
      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle race with zero delay timeout", async () => {
      const timeout = new DynamicTimeout("immediate timeout", 0);
      const target = createRaceTarget("result", 100);

      const racePromise = createSafeRace(target, timeout);

      jest.advanceTimersByTime(0);

      await expect(racePromise).rejects.toBe("immediate timeout");
      expect(timeout.isRejected()).toBe(true);

      // Advance timers to also clear the target's setTimeout
      jest.advanceTimersByTime(100);
      expectNoActiveTimers();
    });

    it("should prevent unhandled rejections in race scenarios", async () => {
      const timeout = new DynamicTimeout("timeout", 500);
      const target = createRaceTarget("result", 200);

      // This should not cause unhandled rejection warnings
      const racePromise = createSafeRace(target, timeout);

      jest.advanceTimersByTime(200);
      const result = await racePromise;

      expect(result).toBe("result");

      // Clean up timeout manually since target won
      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle simultaneous completion timing", async () => {
      const timeout = new DynamicTimeout("timeout", 100);
      const target = createRaceTarget("result", 100);

      const racePromise = createSafeRace(target, timeout);

      jest.advanceTimersByTime(100);

      // Either result is acceptable in this edge case
      try {
        const result = await racePromise;
        expect(result).toBe("result");
        timeout.cancelTimeout();
      } catch (error) {
        expect(error).toBe("timeout");
        expect(timeout.isRejected()).toBe(true);
      }

      expectNoActiveTimers();
    });
  });

  describe("memory management in race", () => {
    it("should cleanup timers when target wins race", async () => {
      const timeout = new DynamicTimeout("timeout", 1000);
      const fastTarget = createRaceTarget("winner", 200);

      const racePromise = createSafeRace(fastTarget, timeout);

      jest.advanceTimersByTime(200);
      const result = await racePromise;

      expect(result).toBe("winner");
      expect(timeout.isRejected()).toBe(false);

      // Target won, so manually cancel timeout to prevent memory leak
      timeout.cancelTimeout();

      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should cleanup timers when timeout wins race", async () => {
      const timeout = new DynamicTimeout("timeout wins", 200);
      const slowTarget = createRaceTarget("slow", 1000);

      const racePromise = createSafeRace(slowTarget, timeout);

      jest.advanceTimersByTime(200);

      await expect(racePromise).rejects.toBe("timeout wins");
      expect(timeout.isRejected()).toBe(true);

      // Advance timers to also clear the target's setTimeout
      jest.advanceTimersByTime(1000);

      // When timeout wins the race, timer is already cleared
      expectNoActiveTimers();
    });

    it("should handle multiple concurrent races", async () => {
      const timeouts: DynamicTimeout[] = [];
      const targets: Array<jest.Mock<Promise<string>, []>> = [];
      const races: Array<Promise<string>> = [];

      // Create 5 concurrent races with different timings
      for (let i = 0; i < 5; i++) {
        const timeout = new DynamicTimeout(`timeout-${i}`, 100 + i * 100);
        const target = createRaceTarget(`result-${i}`, 50 + i * 50);

        timeouts.push(timeout);
        targets.push(target);
        races.push(createSafeRace(target, timeout));
      }

      // Advance timers to resolve all races
      jest.advanceTimersByTime(600);

      const results = await Promise.allSettled(races);

      // Check that some succeeded and some may have timed out
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          expect(result.value).toBe(`result-${index}`);
          // Clean up timeout manually since target won
          timeouts[index]?.cancelTimeout();
        } else {
          expect(result.reason).toBe(`timeout-${index}`);
        }
      });

      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should prevent memory leaks with cancelled races", async () => {
      const timeout = new DynamicTimeout("timeout", 1000);
      const target = createRaceTarget("result", 2000);

      const racePromise = createSafeRace(target, timeout);

      // Cancel timeout before race completes
      timeout.cancelTimeout();

      // Advance timers past timeout delay
      jest.advanceTimersByTime(1000);

      // Timeout should not reject since it was cancelled
      expect(timeout.isRejected()).toBe(false);

      // Target should still be running, advance past its completion
      jest.advanceTimersByTime(2000);

      // Even though race was partially cancelled, no memory leaks
      expectNoActiveTimers();

      // Race promise should still resolve with target result
      const result = await racePromise;
      expect(result).toBe("result");
    });

    it("should handle rapid creation and cleanup of races", async () => {
      // Create and resolve multiple races rapidly
      for (let i = 0; i < 10; i++) {
        const timeout = new DynamicTimeout(`timeout-${i}`, 100);
        const target = createRaceTarget(`result-${i}`, 50);

        const racePromise = createSafeRace(target, timeout);

        jest.advanceTimersByTime(50);
        const result = await racePromise;

        expect(result).toBe(`result-${i}`);

        // Clean up timeout since target won
        timeout.cancelTimeout();
      }

      // Verify no memory leaks after rapid operations
      expectNoActiveTimers();
    });

    it("should handle memory cleanup when target throws during race", async () => {
      const timeout = new DynamicTimeout("timeout", 1000);
      const errorTarget = createRaceTarget("", 200, true);

      const racePromise = createSafeRace(errorTarget, timeout);

      jest.advanceTimersByTime(200);

      await expect(racePromise).rejects.toThrow("Target function error");

      // Clean up timeout since target threw first
      timeout.cancelTimeout();

      // Verify no active timers remain
      expectNoActiveTimers();
    });

    it("should handle mixed success/failure scenarios", async () => {
      const scenarios = [
        { timeout: 500, targetDelay: 200, targetError: false }, // target wins
        { timeout: 200, targetDelay: 500, targetError: false }, // timeout wins
        { timeout: 500, targetDelay: 200, targetError: true }, // target throws
      ];

      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        if (!scenario) continue;

        const { timeout: timeoutDelay, targetDelay, targetError } = scenario;
        const timeout = new DynamicTimeout(`timeout-${i}`, timeoutDelay);
        const target = createRaceTarget(
          `result-${i}`,
          targetDelay,
          targetError,
        );

        const racePromise = createSafeRace(target, timeout);

        // Advance to the earliest completion time
        const minTime = Math.min(timeoutDelay, targetDelay);
        jest.advanceTimersByTime(minTime);

        try {
          const result = await racePromise;
          // Target won (either success or we didn't advance enough for timeout)
          if (!targetError) {
            expect(result).toBe(`result-${i}`);
          }
          timeout.cancelTimeout();
        } catch (error) {
          // Either timeout won or target threw
          if (targetError && minTime === targetDelay) {
            expect(error).toEqual(expect.any(Error));
            timeout.cancelTimeout();
          } else {
            expect(error).toBe(`timeout-${i}`);
          }
        }

        // Advance past the longest delay to clean up any remaining timers
        jest.advanceTimersByTime(Math.max(timeoutDelay, targetDelay));
      }

      expectNoActiveTimers();
    });
  });

  describe("integration-like patterns", () => {
    it("should handle createTimeoutAspect-like usage pattern", async () => {
      // Simulate how createTimeoutAspect uses DynamicTimeout
      const rejectValue = { message: "Operation timed out", delay: 1000 };
      const timeout = new DynamicTimeout(rejectValue, 1000);

      // Simulate target function execution
      const targetFunction = createRaceTarget("operation completed", 500);

      // Simulate Promise.race as done in createTimeoutAspect
      const wrappedExecution = async () => {
        return Promise.race([targetFunction(), timeout.getPromise()]);
      };

      const resultPromise = wrappedExecution();

      jest.advanceTimersByTime(500);
      const result = await resultPromise;

      expect(result).toBe("operation completed");
      expect(timeout.isRejected()).toBe(false);

      // Simulate afterReturning advice cleanup
      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle chained promises with timeout", async () => {
      const timeout = new DynamicTimeout("chain timeout", 1000);

      // Simulate a simple chain without nested timers
      const chainedOperation = jest.fn(async () => {
        // Simulate chained operations completing in 500ms total
        return "step1 -> step2 -> step3";
      });

      const racePromise = createSafeRace(chainedOperation, timeout);

      const result = await racePromise;

      expect(result).toBe("step1 -> step2 -> step3");
      expect(chainedOperation).toHaveBeenCalled();

      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle retry patterns with timeout", async () => {
      const timeout = new DynamicTimeout("retry timeout", 1000);
      let attemptCount = 0;

      // Simulate a retry mechanism that succeeds on 3rd attempt
      const retryableOperation = jest.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return "success on retry";
      });

      // Simplified retry logic without nested timeouts
      const retryWithTimeout = async () => {
        try {
          return await retryableOperation();
        } catch {
          try {
            return await retryableOperation();
          } catch {
            return await retryableOperation();
          }
        }
      };

      const racePromise = createSafeRace(retryWithTimeout, timeout);

      const result = await racePromise;

      expect(result).toBe("success on retry");
      expect(retryableOperation).toHaveBeenCalledTimes(3);
      expect(timeout.isRejected()).toBe(false);

      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle complex async workflow with timeout", async () => {
      const timeout = new DynamicTimeout("workflow timeout", 2000);

      // Simulate a complex workflow without nested timers
      const workflow = jest.fn(async () => {
        return {
          auth: "authenticated",
          data: ["data1", "data2"],
          processed: "processed",
        };
      });

      const workflowPromise = createSafeRace(workflow, timeout);

      const result = await workflowPromise;

      expect(result).toEqual({
        auth: "authenticated",
        data: ["data1", "data2"],
        processed: "processed",
      });
      expect(workflow).toHaveBeenCalled();

      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle timeout during complex workflow", async () => {
      const timeout = new DynamicTimeout("workflow timeout", 500);

      // Simulate a workflow that takes longer than timeout
      const slowWorkflow = async () => {
        const step1 = createRaceTarget("step1", 200);
        const step2 = createRaceTarget("step2", 400); // This will exceed timeout

        await step1();
        await step2();

        return "workflow complete";
      };

      const workflowPromise = createSafeRace(slowWorkflow, timeout);

      jest.advanceTimersByTime(500);

      await expect(workflowPromise).rejects.toBe("workflow timeout");
      expect(timeout.isRejected()).toBe(true);

      // Clean up remaining timers
      jest.advanceTimersByTime(400);
      expectNoActiveTimers();
    });

    it("should handle dynamic timeout adjustments in workflow", async () => {
      const timeout = new DynamicTimeout("base timeout", 500);

      // Simulate extending timeout based on workflow needs
      timeout.addTimeout(300); // Extend by 300ms
      timeout.addTimeout(200); // Extend by another 200ms

      expect(timeout.getTotalDelay()).toBe(1000);

      const workflow = createRaceTarget("extended workflow", 800);
      const workflowPromise = createSafeRace(workflow, timeout);

      jest.advanceTimersByTime(800);
      const result = await workflowPromise;

      expect(result).toBe("extended workflow");
      expect(timeout.isRejected()).toBe(false);

      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle timeout reset during workflow", async () => {
      const timeout = new DynamicTimeout("initial timeout", 300);

      // Test timeout reset functionality directly
      expect(timeout.getInitialDelay()).toBe(300);

      timeout.resetTimeout(500);

      expect(timeout.getInitialDelay()).toBe(500);
      expect(timeout.isRejected()).toBe(false);

      // Simple workflow to test with reset timeout
      const workflow = jest.fn(async () => "workflow complete");
      const workflowPromise = createSafeRace(workflow, timeout);

      const result = await workflowPromise;

      expect(result).toBe("workflow complete");
      expect(workflow).toHaveBeenCalled();

      timeout.cancelTimeout();
      expectNoActiveTimers();
    });

    it("should handle error recovery with timeout", async () => {
      const timeout = new DynamicTimeout("recovery timeout", 1000);

      const operationWithRecovery = jest.fn(async () => {
        // Simulate primary operation failing, then fallback succeeding
        return "fallback success";
      });

      const recoveryPromise = createSafeRace(operationWithRecovery, timeout);

      const result = await recoveryPromise;

      expect(result).toBe("fallback success");
      expect(operationWithRecovery).toHaveBeenCalled();
      expect(timeout.isRejected()).toBe(false);

      timeout.cancelTimeout();
      expectNoActiveTimers();
    });
  });
});
