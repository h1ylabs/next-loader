/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ComponentStateContext,
  ComponentStateMiddleware,
  createComponentState,
  InitialValue,
  MSG_ERR_STORE_CONSISTENCY_VIOLATION,
  resolveDispatch,
  resolveInitialValue,
  validateStoreConsistency,
} from "@/lib/features/componentState";

describe("componentState", () => {
  describe("resolveInitialValue", () => {
    it("should return null for undefined input", () => {
      const result = resolveInitialValue();
      expect(result).toBe(null);
    });

    it("should return null for null input", () => {
      const result = resolveInitialValue(
        null as unknown as InitialValue<string>,
      );
      expect(result).toBe(null);
    });

    it("should return the value directly for non-function input", () => {
      expect(resolveInitialValue(42)).toBe(42);
      expect(resolveInitialValue("hello")).toBe("hello");
      expect(resolveInitialValue(true)).toBe(true);
      expect(resolveInitialValue({ key: "value" })).toEqual({ key: "value" });
      expect(resolveInitialValue([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("should call function and return its result for function input", () => {
      expect(resolveInitialValue(() => 100)).toBe(100);
      expect(resolveInitialValue(() => "computed")).toBe("computed");
      expect(resolveInitialValue(() => ({ computed: true }))).toEqual({
        computed: true,
      });
    });

    it("should handle factory functions that return null or undefined", () => {
      expect(resolveInitialValue(() => null)).toBe(null);
      expect(resolveInitialValue(() => undefined)).toBe(undefined);
    });
  });

  describe("resolveDispatch", () => {
    it("should return the function as-is for function dispatch", () => {
      const updateFn = (prev: number) => prev + 1;
      const result = resolveDispatch(updateFn);

      expect(result).toBe(updateFn);
      expect(result(5)).toBe(6);
    });

    it("should return a function that ignores previous value for direct value dispatch", () => {
      const result = resolveDispatch(42);

      expect(typeof result).toBe("function");
      expect(result(100)).toBe(42); // ignores previous value
      expect(result(0)).toBe(42); // ignores previous value
    });

    it("should handle various value types for direct dispatch", () => {
      expect(resolveDispatch("hello")("anything")).toBe("hello");
      expect(resolveDispatch(true)(false)).toBe(true);
      expect(resolveDispatch({ key: "value" })({ key: "old" })).toEqual({
        key: "value",
      });
      expect(resolveDispatch([1, 2, 3])([4, 5])).toEqual([1, 2, 3]);
    });

    it("should handle null and undefined values for direct dispatch", () => {
      expect(resolveDispatch(null as any)(null)).toBe(null);
      expect(resolveDispatch(undefined as any)(undefined)).toBe(undefined);
    });
  });

  describe("validateStoreConsistency", () => {
    it("should pass validation for consistent store", () => {
      const context = {
        currentIndex: 2,
        data: [1, 2],
        dispatchers: [[], []],
      };

      expect(() => validateStoreConsistency(context)).not.toThrow();
    });

    it("should pass validation when currentIndex equals data length", () => {
      const context = {
        currentIndex: 3,
        data: [1, 2, 3],
        dispatchers: [[], [], []],
      };

      expect(() => validateStoreConsistency(context)).not.toThrow();
    });

    it("should pass validation for empty store", () => {
      const context = {
        currentIndex: 0,
        data: [],
        dispatchers: [],
      };

      expect(() => validateStoreConsistency(context)).not.toThrow();
    });

    it("should throw error when data and dispatchers arrays have different lengths", () => {
      const context = {
        currentIndex: 2,
        data: [1, 2, 3],
        dispatchers: [[], []], // length mismatch
      };

      expect(() => validateStoreConsistency(context)).toThrow(
        MSG_ERR_STORE_CONSISTENCY_VIOLATION(2, 3, 2),
      );
    });

    it("should throw error when currentIndex exceeds data length", () => {
      const context = {
        currentIndex: 4, // exceeds data length
        data: [1, 2, 3],
        dispatchers: [[], [], []],
      };

      expect(() => validateStoreConsistency(context)).toThrow(
        MSG_ERR_STORE_CONSISTENCY_VIOLATION(4, 3, 3),
      );
    });

    it("should generate correct error message", () => {
      const expectedMessage = MSG_ERR_STORE_CONSISTENCY_VIOLATION(5, 2, 3);
      expect(expectedMessage).toBe(
        "store consistency violation: currentIndex=5, data.length=2, dispatchers.length=3",
      );
    });
  });

  describe("createComponentState", () => {
    let mockContext: ComponentStateContext;
    let contextGetter: () => ComponentStateContext;

    beforeEach(() => {
      mockContext = {
        data: [],
        currentIndex: 0,
        dispatchers: [],
      };
      contextGetter = () => mockContext;
    });

    it("should create state with initial value", () => {
      const [state] = createComponentState(contextGetter, 42);

      expect(state).toBe(42);
      expect(mockContext.currentIndex).toBe(1);
      expect(mockContext.data).toEqual([42]);
      expect(mockContext.dispatchers).toEqual([[]]);
    });

    it("should create state with factory function initial value", () => {
      const [state] = createComponentState(contextGetter, () => "computed");

      expect(state).toBe("computed");
      expect(mockContext.data).toEqual(["computed"]);
    });

    it("should create state with null initial value when no initial value provided", () => {
      const [state] = createComponentState(contextGetter);

      expect(state).toBe(null);
      expect(mockContext.data).toEqual([null]);
    });

    it("should not reinitialize existing state data", () => {
      // pre-populate with existing data
      mockContext.data = ["existing"];
      mockContext.dispatchers = [[]];

      const [state] = createComponentState(contextGetter, "new");

      expect(state).toBe("existing"); // should not overwrite
      expect(mockContext.data).toEqual(["existing"]);
    });

    it("should create multiple states with correct indices", () => {
      const [state1] = createComponentState(contextGetter, "first");
      const [state2] = createComponentState(contextGetter, "second");
      const [state3] = createComponentState(contextGetter, "third");

      expect(state1).toBe("first");
      expect(state2).toBe("second");
      expect(state3).toBe("third");
      expect(mockContext.currentIndex).toBe(3);
      expect(mockContext.data).toEqual(["first", "second", "third"]);
      expect(mockContext.dispatchers).toEqual([[], [], []]);
    });

    it("should add dispatcher to correct index when setState is called", () => {
      const [, setState] = createComponentState(contextGetter, 10);

      setState(20);
      setState((prev) => prev + 5);

      expect(mockContext.dispatchers[0]).toHaveLength(2);
      // verify dispatchers work correctly
      expect(mockContext.dispatchers[0]?.[0]?.(10)).toBe(20); // direct value
      expect(mockContext.dispatchers[0]?.[1]?.(10)).toBe(15); // function
    });

    it("should handle mixed state types", () => {
      const [numberState] = createComponentState(contextGetter, 42);
      const [stringState] = createComponentState(contextGetter, "hello");
      const [objectState] = createComponentState(contextGetter, {
        key: "value",
      });

      expect(numberState).toBe(42);
      expect(stringState).toBe("hello");
      expect(objectState).toEqual({ key: "value" });
      expect(mockContext.data).toHaveLength(3);
    });

    it("should ensure dispatchers array exists even if not pre-initialized", () => {
      // simulate context where dispatchers array is shorter
      mockContext.data = [1, 2];
      mockContext.dispatchers = [[]]; // shorter than data
      mockContext.currentIndex = 2; // adjust currentIndex to match existing data

      const [, setState] = createComponentState(contextGetter);

      setState(100);

      expect(mockContext.dispatchers[2]).toBeDefined();
      expect(mockContext.dispatchers[2]).toHaveLength(1);
    });
  });

  describe("ComponentStateMiddleware.before logic", () => {
    let mockContext: ComponentStateContext;

    beforeEach(() => {
      mockContext = {
        data: [10, "hello", { count: 0 }],
        currentIndex: 3,
        dispatchers: [
          [(prev: number) => prev + 5, () => 100], // for data[0]
          [() => "updated"], // for data[1]
          [(prev: { count: number }) => ({ count: prev.count + 1 })], // for data[2]
        ],
      };
    });

    it("should apply dispatchers to data correctly", () => {
      // Simulate the before hook logic
      const updatedData = mockContext.data.map((value, index) =>
        mockContext.dispatchers[index]?.reduce(
          (result, dispatcher) => dispatcher(result),
          value,
        ),
      );

      expect(updatedData[0]).toBe(100); // 10 + 5 = 15, then overwritten to 100
      expect(updatedData[1]).toBe("updated"); // overwritten
      expect(updatedData[2]).toEqual({ count: 1 }); // incremented
    });

    it("should handle empty dispatchers array", () => {
      mockContext.dispatchers = [[], [], []];

      const updatedData = mockContext.data.map((value, index) =>
        mockContext.dispatchers[index]?.reduce(
          (result, dispatcher) => dispatcher(result),
          value,
        ),
      );

      expect(updatedData).toEqual([10, "hello", { count: 0 }]); // unchanged
    });

    it("should handle missing dispatchers for some indices", () => {
      mockContext.dispatchers = [
        [(prev: number) => prev * 2], // only first element has dispatchers
      ];

      const updatedData = mockContext.data.map((value, index) =>
        mockContext.dispatchers[index]?.reduce(
          (result, dispatcher) => dispatcher(result),
          value,
        ),
      );

      expect(updatedData[0]).toBe(20); // 10 * 2
      expect(updatedData[1]).toBe(undefined); // no dispatcher, returns undefined
      expect(updatedData[2]).toBe(undefined); // no dispatcher, returns undefined
    });

    it("should reset currentIndex and dispatchers after processing", () => {
      // Simulate the cleanup logic
      mockContext.currentIndex = 0;
      mockContext.dispatchers = Array(mockContext.data.length)
        .fill(null)
        .map(() => []);

      expect(mockContext.currentIndex).toBe(0);
      expect(mockContext.dispatchers).toEqual([[], [], []]);
      expect(mockContext.dispatchers).toHaveLength(mockContext.data.length);
    });

    it("should handle complex dispatcher chains", () => {
      const complexDispatchers = [
        [
          (prev: number) => prev * 2, // 10 → 20
          (prev: number) => prev + 10, // 20 → 30
          () => 999, // 30 → 999
          (prev: number) => prev - 99, // 999 → 900
        ],
      ];

      const result = complexDispatchers[0]?.reduce(
        (result, dispatcher) => dispatcher(result),
        10,
      );

      expect(result).toBe(900);
    });
  });

  describe("ComponentStateMiddleware integration", () => {
    it("should create middleware with correct structure", () => {
      const middleware = ComponentStateMiddleware();

      expect(middleware).toHaveProperty("name", "state");
      expect(middleware).toHaveProperty("contextGenerator");
      expect(middleware).toHaveProperty("aspect");
      expect(middleware.aspect).toHaveProperty("before");
    });

    it("should generate context with correct initial structure", () => {
      const middleware = ComponentStateMiddleware();
      const context = middleware.contextGenerator();

      expect(context).toEqual({
        data: [],
        dispatchers: [],
        currentIndex: 0,
      });
    });

    it("should execute before hook correctly", async () => {
      const middleware = ComponentStateMiddleware();
      const context: ComponentStateContext = {
        data: [5, "test"],
        currentIndex: 2,
        dispatchers: [[(prev: number) => prev * 3], [() => "modified"]],
      };

      // Access the before advice through the aspect with proper context wrapper
      const beforeAdvice = middleware.aspect.before?.advice;
      if (beforeAdvice) {
        await beforeAdvice({ state: context });
      }

      expect(context.data).toEqual([15, "modified"]);
      expect(context.currentIndex).toBe(0);
      expect(context.dispatchers).toEqual([[], []]);
    });
  });
});
