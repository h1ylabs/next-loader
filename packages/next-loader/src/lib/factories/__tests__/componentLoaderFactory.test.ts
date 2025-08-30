/* eslint-disable @typescript-eslint/no-explicit-any */
import { middleware } from "@h1y/loader-core";
import type { TargetWrapper } from "@h1y/promise-aop";

import { componentLoaderFactory } from "@/lib/factories/componentLoaderFactory";
import type { ComponentFunction } from "@/lib/models/component";

// mock element types for testing without react
type MockElement = {
  type: string;
  props: Record<string, unknown>;
  children?: MockElement[];
};

type MockProps = {
  userId: string;
};

// simple mock wrapper (no react dependencies)
const createSimpleMockWrapper = (): ((
  element?: MockElement,
) => TargetWrapper<MockElement>) => {
  return () => (target) => async () => {
    const result = await target();
    return result; // pass through without wrapping for simplicity
  };
};

// suspense-like mock wrapper that mimics react suspense behavior
const createSuspenseLikeMockWrapper = (): ((
  element?: MockElement,
) => TargetWrapper<MockElement>) => {
  return (fallbackElement?: MockElement) => (target) => async () => {
    const result = await target();
    return {
      type: "suspense-wrapper",
      props: { fallback: fallbackElement },
      children: [result],
    };
  };
};

// helper to create mock components
const createMockComponent = <Props>(
  name: string,
  behavior: "success" | "error" | "timeout" = "success",
): ComponentFunction<Props, MockElement> => {
  return async (props: Props) => {
    switch (behavior) {
      case "error":
        throw new Error(`Mock ${name} failed`);
      case "timeout":
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { type: name, props: props as Record<string, unknown> };
      case "success":
      default:
        return { type: name, props: props as Record<string, unknown> };
    }
  };
};

describe("componentLoaderFactory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Operations", () => {
    it("should execute component successfully", async () => {
      const mockWrapper = createSimpleMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const mockComponent = createMockComponent<MockProps>(
        "TestComponent",
        "success",
      );
      const wrappedComponent = loader.componentLoader(mockComponent);

      const result = await wrappedComponent({ userId: "123" });

      expect(result).toEqual({
        type: "TestComponent",
        props: { userId: "123" },
      });
    });

    it("should retry on error", async () => {
      const mockWrapper = createSimpleMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 2000 },
        },
      });

      let callCount = 0;
      const failThenSucceedComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        callCount++;
        if (callCount <= 2) {
          throw new Error(`Attempt ${callCount} failed`);
        }
        return {
          type: "RetryComponent",
          props: props as Record<string, unknown>,
        };
      };

      const wrappedComponent = loader.componentLoader(failThenSucceedComponent);
      const result = await wrappedComponent({ userId: "retry-test" });

      expect(callCount).toBe(3); // initial + 2 retries
      expect(result).toEqual({
        type: "RetryComponent",
        props: { userId: "retry-test" },
      });
    });

    it("should fail when max retry count exceeded", async () => {
      const mockWrapper = createSimpleMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 2000 },
        },
      });

      let callCount = 0;
      const alwaysFailComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async () => {
        callCount++;
        throw new Error(`Permanent failure ${callCount}`);
      };

      const wrappedComponent = loader.componentLoader(alwaysFailComponent);

      await expect(wrappedComponent({ userId: "fail-test" })).rejects.toThrow(
        "loader retry limit exceeded",
      );

      expect(callCount).toBe(2); // initial + 1 retry
    });
  });

  describe("Failure and Retry (Advanced)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should handle initial failure → automatic retry → success (suspense wrapper)", async () => {
      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 2000 },
        },
      });

      let callCount = 0;
      const failThenSucceedComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        callCount++;
        if (callCount <= 2) {
          throw new Error(`Attempt ${callCount} failed`);
        }
        return {
          type: "RetryComponent",
          props: props as Record<string, unknown>,
        };
      };

      const wrappedComponent = loader.componentLoader(failThenSucceedComponent);
      const result = await wrappedComponent({ userId: "retry-test" });

      expect(callCount).toBe(3); // initial + 2 retries

      // wrapper gets nested due to retry mechanism
      expect(result).toEqual({
        type: "suspense-wrapper",
        props: { fallback: undefined },
        children: [
          {
            type: "suspense-wrapper",
            props: { fallback: undefined },
            children: [
              { type: "RetryComponent", props: { userId: "retry-test" } },
            ],
          },
        ],
      });
    });

    it("should complete successfully within timeout", async () => {
      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const fastComponent: ComponentFunction<MockProps, MockElement> = async (
        props,
      ) => {
        // short delay then success
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          type: "FastComponent",
          props: props as Record<string, unknown>,
        };
      };

      const wrappedComponent = loader.componentLoader(fastComponent);

      // handle promise and timer simultaneously
      const resultPromise = wrappedComponent({ userId: "timeout-test" });

      // advance only short delay (before timeout)
      await jest.runOnlyPendingTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual({
        type: "FastComponent",
        props: { userId: "timeout-test" },
      });
    });

    it("should throw TimeoutSignal on timeout", async () => {
      // real-time based test (timeout verification)
      jest.useRealTimers(); // use real timers

      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 10 }, // 10ms timeout
        },
      });

      const slowComponent: ComponentFunction<MockProps, MockElement> = async (
        props,
      ) => {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms wait (longer than timeout)
        return {
          type: "SlowComponent",
          props: props as Record<string, unknown>,
        };
      };

      const wrappedComponent = loader.componentLoader(slowComponent);

      const start = Date.now();
      await expect(
        wrappedComponent({ userId: "timeout-test" }),
      ).rejects.toThrow();
      const elapsed = Date.now() - start;

      // verify timeout occurred quickly as expected (within 50ms)
      expect(elapsed).toBeLessThan(50);

      jest.useFakeTimers(); // return to fake timers
    }, 1000);

    it("should handle manual retryComponent() call", async () => {
      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 1, canRetryOnError: true },
          timeout: { delay: 1000 },
        },
      });

      let retryCount = 0;
      const componentWithManualRetry: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        if (retryCount === 0) {
          retryCount++;
          // simulate manual retry call within component
          loader.retryImmediately({
            type: "loading",
            props: { message: "Retrying..." },
          });
          throw new Error("First attempt failed");
        }
        return {
          type: "ManualRetryComponent",
          props: props as Record<string, unknown>,
        };
      };

      const wrappedComponent = loader.componentLoader(componentWithManualRetry);
      const result = await wrappedComponent({ userId: "manual-retry" });

      // wrapper is applied once with manual retry fallback
      expect(result).toEqual({
        type: "suspense-wrapper",
        props: {
          fallback: { type: "loading", props: { message: "Retrying..." } },
        },
        children: [
          {
            type: "ManualRetryComponent",
            props: { userId: "manual-retry" },
          },
        ],
      });
      expect(retryCount).toBe(1);
    });
  });

  describe("Streaming SSR Simulation", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return immediate result (suspense behavior simulation)", async () => {
      let resolveTarget: (() => void) | undefined;
      const targetPromise = new Promise<void>((resolve) => {
        resolveTarget = resolve;
      });

      // wrapper that simulates streaming ssr
      const streamingWrapper = (
        fallbackElement?: MockElement,
      ): TargetWrapper<MockElement> => {
        return (target) => async () => {
          // immediately return suspense-like structure (break async chain)
          const suspenseStructure = {
            type: "suspense-boundary",
            props: { fallback: fallbackElement },
            children: [{ type: "placeholder", props: { pending: true } }],
          };

          // handle promise internally (separate execution)
          targetPromise
            .then(async () => {
              const actualResult = await target();
              // react would replace internally, but verify structure in test
              suspenseStructure.children = [actualResult as any];
            })
            .catch(() => {
              // error handling
            });

          return suspenseStructure;
        };
      };

      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: streamingWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const asyncComponent: ComponentFunction<MockProps, MockElement> = async (
        props,
      ) => {
        await targetPromise; // wait for actual async work
        return {
          type: "AsyncComponent",
          props: props as Record<string, unknown>,
        };
      };

      const wrappedComponent = loader.componentLoader(asyncComponent);

      // resolve promise to complete async work
      if (resolveTarget) {
        resolveTarget();
      }
      await targetPromise;

      // return actual content (after async work completion)
      const resultPromise = wrappedComponent({ userId: "streaming-test" });
      const result = await resultPromise;

      // verify expected behavior - async component was executed directly
      expect(result).toEqual({
        type: "AsyncComponent",
        props: { userId: "streaming-test" },
      });
    });
  });

  describe("Type Safety", () => {
    it("should propagate generic types correctly", async () => {
      // test custom element type
      type CustomElement = {
        tagName: string;
        attributes: Record<string, string>;
        content: string;
      };

      const customWrapper = (): TargetWrapper<CustomElement> => {
        return (target) => async () => {
          const result = await target();
          return {
            tagName: "wrapper",
            attributes: { wrapped: "true" },
            content: `wrapped(${result.content})`,
          };
        };
      };

      const customLoader = componentLoaderFactory<CustomElement, []>({
        wrapper: customWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const customComponent: ComponentFunction<
        MockProps,
        CustomElement
      > = async (props) => {
        return {
          tagName: "custom",
          attributes: { userId: props.userId },
          content: `Hello ${props.userId}`,
        };
      };

      const wrappedCustomComponent =
        customLoader.componentLoader(customComponent);
      const result = await wrappedCustomComponent({ userId: "type-test" });

      expect(result).toEqual({
        tagName: "custom",
        attributes: { userId: "type-test" },
        content: "Hello type-test",
      });
    });

    it("should maintain ComponentFunction<Props, Element> consistency", async () => {
      interface SpecificProps {
        name: string;
        age: number;
        optional?: boolean;
      }

      type SpecificElement = {
        component: string;
        data: SpecificProps;
        timestamp: number;
      };

      const specificWrapper = (): TargetWrapper<SpecificElement> => {
        return (target) => target;
      };

      const specificLoader = componentLoaderFactory<SpecificElement, []>({
        wrapper: specificWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const specificComponent: ComponentFunction<
        SpecificProps,
        SpecificElement
      > = async (props) => {
        return {
          component: "SpecificComponent",
          data: props,
          timestamp: Date.now(),
        };
      };

      const wrappedSpecific = specificLoader.componentLoader(specificComponent);

      const result = await wrappedSpecific({
        name: "John",
        age: 30,
        optional: true,
      });

      expect(result.component).toBe("SpecificComponent");
      expect(result.data).toEqual({ name: "John", age: 30, optional: true });
      expect(typeof result.timestamp).toBe("number");
    });
  });

  describe("Component State Management", () => {
    it("should handle componentState basic operations", async () => {
      const mockWrapper = createSimpleMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const stateTestComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        // create basic states
        const [state1] = loader.componentState<number>(1);
        const [state2] = loader.componentState<string>("initial");

        return {
          type: "StateTestComponent",
          props: {
            ...(props as Record<string, unknown>),
            state1,
            state2,
          },
        };
      };

      const wrappedComponent = loader.componentLoader(stateTestComponent);
      const result = await wrappedComponent({ userId: "state-test" });

      expect(result.props).toMatchObject({
        userId: "state-test",
        state1: 1,
        state2: "initial",
      });
    });

    it("should guarantee componentState() call order (suspense wrapper)", async () => {
      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: 1000 },
        },
      });

      const stateSequenceComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        // create multiple states sequentially
        const [state1] = loader.componentState<number>(1);
        const [state2] = loader.componentState<string>("initial");
        const [state3] = loader.componentState<boolean>(() => false); // wrap with function to avoid falsy issues

        return {
          type: "StateSequenceComponent",
          props: {
            ...(props as Record<string, unknown>),
            state1,
            state2,
            state3,
          },
        };
      };

      const wrappedComponent = loader.componentLoader(stateSequenceComponent);
      const result = await wrappedComponent({ userId: "state-test" });

      expect(result).toEqual({
        type: "StateSequenceComponent",
        props: {
          userId: "state-test",
          state1: 1,
          state2: "initial",
          state3: false,
        },
      });
    });

    it("should handle multiple states simultaneously and update (including retry) - temporarily skipped due to architecture issues", async () => {
      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 5, canRetryOnError: true }, // allow sufficient count for component state testing
          timeout: { delay: 1000 },
        },
      });

      let executionCount = 0;
      const multiStateComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        executionCount++;

        const [counter, setCounter] = loader.componentState<number>(0);
        const [name, setName] = loader.componentState<string>("anonymous");
        const [flags, setFlags] = loader.componentState<
          Record<string, boolean>
        >(() => ({ active: false }));

        // update state then throw error on first execution
        if (executionCount === 1) {
          setCounter((counter ?? 0) + 1);
          setName("updated");
          setFlags((prev) => ({
            ...(prev ?? { active: false }),
            active: true,
          }));
          throw new Error("First execution failed");
        }

        // use updated state on second execution
        return {
          type: "MultiStateComponent",
          props: {
            ...(props as Record<string, unknown>),
            counter,
            name,
            flags,
            executionCount,
          },
        };
      };

      const wrappedComponent = loader.componentLoader(multiStateComponent);
      const result = await wrappedComponent({ userId: "multi-state" });

      expect(executionCount).toBe(2);
      expect(result).toEqual({
        type: "suspense-wrapper",
        props: { fallback: undefined },
        children: [
          {
            type: "MultiStateComponent",
            props: {
              userId: "multi-state",
              counter: 1, // value updated in first execution
              name: "updated", // value updated in first execution
              flags: { active: true }, // value updated in first execution
              executionCount: 2,
            },
          },
        ],
      });
    });

    it("should handle state update dispatcher operations (including retry) - temporarily skipped due to architecture issues", async () => {
      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 5, canRetryOnError: true }, // allow sufficient count for component state testing
          timeout: { delay: 1000 },
        },
      });

      let executionCount = 0;
      const dispatcherTestComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        executionCount++;

        const [value, setValue] = loader.componentState<number>(10);
        const [obj, setObj] = loader.componentState<{
          count: number;
          name: string;
        }>(() => ({ count: 0, name: "test" }));

        if (executionCount === 1) {
          // test various dispatcher patterns on first execution
          setValue((prev) => (prev ?? 10) * 2); // functional update: 10 * 2 = 20
          setValue(50); // direct value setting: 50

          setObj((prev) => ({
            ...(prev ?? { count: 0, name: "test" }),
            count: (prev?.count ?? 0) + 1,
          })); // count: 1
          setObj({ count: 100, name: "updated" }); // direct object setting

          throw new Error("First execution to test dispatcher");
        }

        // verify dispatcher results on second execution
        return {
          type: "DispatcherTestComponent",
          props: {
            ...(props as Record<string, unknown>),
            value, // changed to 50 by dispatcher
            obj, // changed to {count: 100, name: "updated"} by dispatcher
            executionCount,
          },
        };
      };

      const wrappedComponent = loader.componentLoader(dispatcherTestComponent);
      const result = await wrappedComponent({ userId: "dispatcher-test" });

      expect(executionCount).toBe(2);
      expect(result).toEqual({
        type: "suspense-wrapper",
        props: { fallback: undefined },
        children: [
          {
            type: "DispatcherTestComponent",
            props: {
              userId: "dispatcher-test",
              value: 50, // last set value
              obj: { count: 100, name: "updated" }, // last set value
              executionCount: 2,
            },
          },
        ],
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw appropriate error for invalid timeout when component is executed", async () => {
      const mockWrapper = createSimpleMockWrapper();

      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 0, canRetryOnError: false },
          timeout: { delay: -100 }, // negative timeout
        },
      });

      const simpleComponent: ComponentFunction<MockProps, MockElement> = async (
        props,
      ) => {
        return {
          type: "TestComponent",
          props: props as Record<string, unknown>,
        };
      };

      const wrappedComponent = loader.componentLoader(simpleComponent);

      await expect(wrappedComponent({ userId: "error-test" })).rejects.toThrow(
        "timeout.delay must be a non-negative number",
      );
    });

    it("should access componentOptions", async () => {
      const mockWrapper = createSimpleMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 1000 },
        },
      });

      const optionsTestComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        const options = loader.componentOptions();

        return {
          type: "OptionsTestComponent",
          props: {
            ...(props as Record<string, unknown>),
            retryMaxCount: options.retry.maxCount,
            timeoutDelay: options.timeout.delay,
          },
        };
      };

      const wrappedOptions = loader.componentLoader(optionsTestComponent);
      const result = await wrappedOptions({ userId: "options-test" });

      expect(result.props).toMatchObject({
        userId: "options-test",
        retryMaxCount: 2,
        timeoutDelay: 1000,
      });
    });

    it("should access componentOptions (suspense wrapper)", async () => {
      const mockWrapper = createSuspenseLikeMockWrapper();
      const loader = componentLoaderFactory<MockElement, []>({
        wrapper: mockWrapper,
        props: {
          retry: { maxCount: 2, canRetryOnError: true },
          timeout: { delay: 1000 },
        },
      });

      const optionsTestComponent: ComponentFunction<
        MockProps,
        MockElement
      > = async (props) => {
        const options = loader.componentOptions();

        // test retry options available
        // retry options are accessible through options.retry

        return {
          type: "OptionsTestComponent",
          props: {
            ...(props as Record<string, unknown>),
            retryMaxCount: options.retry.maxCount,
            timeoutDelay: options.timeout.delay,
          },
        };
      };

      const wrappedOptions = loader.componentLoader(optionsTestComponent);
      const result = await wrappedOptions({ userId: "options-test" });

      expect(result).toEqual({
        type: "OptionsTestComponent",
        props: {
          userId: "options-test",
          retryMaxCount: 2,
          timeoutDelay: 1000,
        },
      });
    });
  });

  describe("Middleware System", () => {
    // Custom middleware implementations for testing
    const LoggingMiddleware = () =>
      middleware<MockElement>().withOptions({
        name: "logging",
        contextGenerator: () => ({ logs: [] as string[] }),
        async before(context: { logs: string[] }) {
          context.logs.push("before");
        },
        async complete(context: { logs: string[] }) {
          context.logs.push("complete");
        },
        async failure(context: { logs: string[] }) {
          context.logs.push("failure");
        },
      });

    const CacheMiddleware = () =>
      middleware<MockElement>().withOptions({
        name: "cache",
        contextGenerator: () => ({
          cache: new Map() as Map<string, MockElement>,
        }),
        async before(context) {
          // Cache logic would go here
          context.cache.set("lastAccess", {
            type: "timestamp",
            props: { time: Date.now() },
          });
        },
      });

    const MetricsMiddleware = () =>
      middleware<MockElement>().withOptions({
        name: "metrics",
        contextGenerator: () => ({
          startTime: 0,
          endTime: 0,
          executionCount: 0,
        }),
        async before(context: {
          startTime: number;
          endTime: number;
          executionCount: number;
        }) {
          context.startTime = Date.now();
          context.executionCount++;
        },
        async complete(context: {
          startTime: number;
          endTime: number;
          executionCount: number;
        }) {
          context.endTime = Date.now();
        },
      });

    describe("Single Middleware", () => {
      it("should work with LoggingMiddleware", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<
          MockElement,
          [ReturnType<typeof LoggingMiddleware>]
        >({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 0, canRetryOnError: false },
            timeout: { delay: 1000 },
          },
          middlewares: [LoggingMiddleware()],
        });

        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          // Access logging context
          const loggingContext = loader.loggingMiddlewareOptions();

          return {
            type: "LoggingTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              logs: loggingContext.logs,
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "logging-test" });

        expect(result.props.logs).toEqual(["before", "complete"]);
      });

      it("should work with CacheMiddleware", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<
          MockElement,
          [ReturnType<typeof CacheMiddleware>]
        >({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 0, canRetryOnError: false },
            timeout: { delay: 1000 },
          },
          middlewares: [CacheMiddleware()],
        });

        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          // Access cache context
          const cacheContext = loader.cacheMiddlewareOptions();

          return {
            type: "CacheTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              cacheSize: cacheContext.cache.size,
              hasTimestamp: cacheContext.cache.has("lastAccess"),
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "cache-test" });

        expect(result.props.cacheSize).toBe(1);
        expect(result.props.hasTimestamp).toBe(true);
      });

      it("should work with MetricsMiddleware", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<
          MockElement,
          [ReturnType<typeof MetricsMiddleware>]
        >({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 0, canRetryOnError: false },
            timeout: { delay: 1000 },
          },
          middlewares: [MetricsMiddleware()],
        });

        let metricsContextSnapshot: any;
        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          // Take snapshot of context during execution
          metricsContextSnapshot = loader.metricsMiddlewareOptions();

          // Add small delay to ensure startTime and endTime are different
          await new Promise((resolve) => setTimeout(resolve, 1));

          return {
            type: "MetricsTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              executionCount: metricsContextSnapshot.executionCount,
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "metrics-test" });

        // Middleware hooks execute properly - both before and complete hooks run
        expect(metricsContextSnapshot.executionCount).toBe(1);
        expect(metricsContextSnapshot.startTime).toBeGreaterThan(0);
        expect(metricsContextSnapshot.endTime).toBeGreaterThan(
          metricsContextSnapshot.startTime,
        ); // complete hook has run!

        // Context is only available during component execution (async context scope)
        // Accessing it after execution completes should throw "async context not found"
        expect(() => loader.metricsMiddlewareOptions()).toThrow(
          "async context not found",
        );
        expect(result.props.executionCount).toBe(1);
      });
    });

    describe("Multiple Middlewares", () => {
      it("should work with combined middlewares", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<
          MockElement,
          [
            ReturnType<typeof LoggingMiddleware>,
            ReturnType<typeof MetricsMiddleware>,
          ]
        >({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 0, canRetryOnError: false },
            timeout: { delay: 1000 },
          },
          middlewares: [LoggingMiddleware(), MetricsMiddleware()],
        });

        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          // Access both contexts
          const loggingContext = loader.loggingMiddlewareOptions();
          const metricsContext = loader.metricsMiddlewareOptions();

          return {
            type: "CombinedTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              logs: loggingContext.logs,
              executionCount: metricsContext.executionCount,
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "combined-test" });

        expect(result.props.logs).toEqual(["before", "complete"]);
        expect(result.props.executionCount).toBe(1);
      });

      it("should execute middlewares in correct order during retry", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<
          MockElement,
          [
            ReturnType<typeof LoggingMiddleware>,
            ReturnType<typeof MetricsMiddleware>,
          ]
        >({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 2, canRetryOnError: true },
            timeout: { delay: 1000 },
          },
          middlewares: [LoggingMiddleware(), MetricsMiddleware()],
        });

        let attemptCount = 0;
        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          attemptCount++;

          // Access contexts
          const loggingContext = loader.loggingMiddlewareOptions();
          const metricsContext = loader.metricsMiddlewareOptions();

          if (attemptCount === 1) {
            throw new Error("First attempt failed");
          }

          return {
            type: "RetryTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              logs: loggingContext.logs,
              executionCount: metricsContext.executionCount,
              attemptCount,
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "retry-test" });

        expect(result.props.attemptCount).toBe(2);
        expect(result.props.executionCount).toBe(2); // should be called twice
        expect(result.props.logs).toEqual([
          "before",
          "failure",
          "before",
          "complete",
        ]);
      });
    });

    describe("ComponentStateMiddleware Integration", () => {
      it("should work with both ComponentState and custom middleware", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<
          MockElement,
          [ReturnType<typeof LoggingMiddleware>]
        >({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 1, canRetryOnError: true },
            timeout: { delay: 1000 },
          },
          middlewares: [LoggingMiddleware()],
        });

        let attemptCount = 0;
        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          attemptCount++;

          // Use componentState (from built-in ComponentStateMiddleware)
          const [counter, setCounter] = loader.componentState<number>(0);
          const [name, setName] = loader.componentState<string>("default");

          // Use custom logging middleware
          const loggingContext = loader.loggingMiddlewareOptions();

          if (attemptCount === 1) {
            setCounter(1);
            setName("updated");
            throw new Error("First attempt failed");
          }

          return {
            type: "IntegratedTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              counter,
              name,
              logs: loggingContext.logs,
              attemptCount,
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "integrated-test" });

        expect(result.props.counter).toBe(1); // state persisted across retry
        expect(result.props.name).toBe("updated"); // state persisted across retry
        expect(result.props.attemptCount).toBe(2);
        expect(result.props.logs).toEqual([
          "before",
          "failure",
          "before",
          "complete",
        ]);
      });

      it("should handle complex state operations with retry", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<MockElement, []>({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 3, canRetryOnError: true },
            timeout: { delay: 1000 },
          },
        });

        let attemptCount = 0;
        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          attemptCount++;

          // Complex state management
          const [items, setItems] = loader.componentState<string[]>(() => []);
          const [metadata, setMetadata] = loader.componentState<{
            created: number;
            updated: number;
            version: number;
          }>(() => ({
            created: Date.now(),
            updated: Date.now(),
            version: 1,
          }));

          // Update state on each attempt
          setItems((prev) => [...(prev || []), `attempt-${attemptCount}`]);
          setMetadata((prev) => ({
            ...(prev || {
              created: Date.now(),
              updated: Date.now(),
              version: 1,
            }),
            updated: Date.now(),
            version: (prev?.version || 1) + 1,
          }));

          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }

          return {
            type: "ComplexStateTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              items,
              metadata,
              attemptCount,
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "complex-state-test" });

        expect(result.props.attemptCount).toBe(3);
        // State is updated only on failed attempts, not on successful one
        expect(result.props.items).toEqual(["attempt-1", "attempt-2"]);
        const metadata = result.props.metadata as {
          version: number;
          created: number;
          updated: number;
        };
        expect(metadata.version).toBe(3); // 1 (initial) + 2 (failed attempts)
        expect(typeof metadata.created).toBe("number");
        expect(typeof metadata.updated).toBe("number");
      });

      it("should handle state initialization patterns correctly", async () => {
        const mockWrapper = createSimpleMockWrapper();
        const loader = componentLoaderFactory<MockElement, []>({
          wrapper: mockWrapper,
          props: {
            retry: { maxCount: 0, canRetryOnError: false },
            timeout: { delay: 1000 },
          },
        });

        const testComponent: ComponentFunction<MockProps, MockElement> = async (
          props,
        ) => {
          // Test different initialization patterns
          const [primitive1] = loader.componentState<number>(42);
          const [primitive2] = loader.componentState<string>("hello");
          const [primitive3] = loader.componentState<boolean>(true);
          const [factory1] = loader.componentState<number[]>(() => [1, 2, 3]);
          const [factory2] = loader.componentState<{ id: string }>(() => ({
            id: "test-id",
          }));
          const [nullable1] = loader.componentState<string | null>(null);
          const [nullable2] = loader.componentState<number | null>(); // no initial value

          return {
            type: "InitializationTestComponent",
            props: {
              ...(props as Record<string, unknown>),
              primitive1,
              primitive2,
              primitive3,
              factory1,
              factory2,
              nullable1,
              nullable2,
            },
          };
        };

        const wrappedComponent = loader.componentLoader(testComponent);
        const result = await wrappedComponent({ userId: "init-test" });

        expect(result.props.primitive1).toBe(42);
        expect(result.props.primitive2).toBe("hello");
        expect(result.props.primitive3).toBe(true);
        expect(result.props.factory1).toEqual([1, 2, 3]);
        expect(result.props.factory2).toEqual({ id: "test-id" });
        expect(result.props.nullable1).toBe(null);
        expect(result.props.nullable2).toBe(null); // undefined becomes null
      });
    });
  });
});
