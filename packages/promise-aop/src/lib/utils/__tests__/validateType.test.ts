import {
  exhaustiveCheckType,
  MSG_ERR_EXHAUSTIVE_CHECK,
  MSG_ERR_INVALID_TYPE,
  validateType,
} from "@/lib/utils/validateType";

describe("validateType", () => {
  describe("valid type validation", () => {
    it("should return the value when it exists in the array", () => {
      const validOptions = ["option1", "option2", "option3"] as const;
      const result = validateType(validOptions, "option2");

      expect(result).toBe("option2");
    });

    it("should work with number arrays", () => {
      const validNumbers = [1, 2, 3] as const;
      const result = validateType(validNumbers, 2);

      expect(result).toBe(2);
    });

    it("should work with boolean arrays", () => {
      const validBooleans = [true, false] as const;
      const result = validateType(validBooleans, true);

      expect(result).toBe(true);
    });

    it("should work with mixed type arrays", () => {
      const validMixed = ["string", 42, true] as const;
      const result1 = validateType(validMixed, "string");
      const result2 = validateType(validMixed, 42);
      const result3 = validateType(validMixed, true);

      expect(result1).toBe("string");
      expect(result2).toBe(42);
      expect(result3).toBe(true);
    });

    it("should work with single element arrays", () => {
      const singleElement = ["only"] as const;
      const result = validateType(singleElement, "only");

      expect(result).toBe("only");
    });
  });

  describe("invalid type validation", () => {
    it("should throw error when value is not in the array", () => {
      const validOptions = ["option1", "option2", "option3"] as const;

      // @ts-expect-error - testing with invalid string option
      expect(() => validateType(validOptions, "invalidOption")).toThrow(
        MSG_ERR_INVALID_TYPE("invalidOption"),
      );
    });

    it("should throw error with number arrays", () => {
      const validNumbers = [1, 2, 3] as const;

      // @ts-expect-error - testing with invalid number value
      expect(() => validateType(validNumbers, 4)).toThrow(
        MSG_ERR_INVALID_TYPE(4),
      );
    });

    it("should throw error with boolean arrays", () => {
      const validBooleans = [true] as const;

      // @ts-expect-error - testing with invalid boolean value
      expect(() => validateType(validBooleans, false)).toThrow(
        MSG_ERR_INVALID_TYPE(false),
      );
    });

    it("should throw error when value type differs", () => {
      const validStrings = ["a", "b", "c"] as const;

      // @ts-expect-error - testing with mismatched type
      expect(() => validateType(validStrings, 123)).toThrow(
        MSG_ERR_INVALID_TYPE(123),
      );
    });

    it("should handle null and undefined values", () => {
      const validValues = ["valid", null, undefined] as const;

      // @ts-expect-error - testing with invalid value among nullable types
      expect(() => validateType(validValues, "invalid")).toThrow(
        MSG_ERR_INVALID_TYPE("invalid"),
      );

      expect(validateType(validValues, null)).toBe(null);
      expect(validateType(validValues, undefined)).toBe(undefined);
    });
  });

  describe("edge cases", () => {
    it("should work with empty arrays", () => {
      const emptyArray = [] as const;

      // @ts-expect-error - testing validation against empty array
      expect(() => validateType(emptyArray, "anything")).toThrow(
        MSG_ERR_INVALID_TYPE("anything"),
      );
    });

    it("should handle complex objects in arrays", () => {
      const obj1 = { id: 1, name: "test1" };
      const obj2 = { id: 2, name: "test2" };
      const validObjects = [obj1, obj2] as const;

      expect(validateType(validObjects, obj1)).toBe(obj1);
      expect(() =>
        validateType(validObjects, { id: 3, name: "test3" }),
      ).toThrow();
    });
  });
});

describe("exhaustiveCheckType", () => {
  it("should handle exhaustive switch case validation", () => {
    type TestAction = "read" | "write" | "delete";
    const actions: TestAction[] = ["read", "write", "delete"];

    const processAction = (action: TestAction): string => {
      switch (action) {
        case "read":
          return "reading data";
        case "write":
          return "writing data";
        case "delete":
          return "deleting data";
        default:
          exhaustiveCheckType(action);
          throw new Error("unreachable code");
      }
    };

    actions.forEach((action) => {
      const result = processAction(action);
      expect(typeof result).toBe("string");
    });
  });

  it("should demonstrate real-world switch exhaustive checking", () => {
    // simulate a function that processes validated enum values
    type ProcessedAction = "start" | "stop";

    const executeAction = (action: ProcessedAction): string => {
      switch (action) {
        case "start":
          return "action started";
        case "stop":
          return "action stopped";
        default:
          // this should never be reached with proper enum values
          exhaustiveCheckType(action);
          throw new Error("unreachable code");
      }
    };

    expect(executeAction("start")).toBe("action started");
    expect(executeAction("stop")).toBe("action stopped");
  });

  it("should always throw error", () => {
    // @ts-expect-error - intentionally passing string to never type
    expect(() => exhaustiveCheckType("unexpected")).toThrow(
      MSG_ERR_EXHAUSTIVE_CHECK("unexpected" as never),
    );
  });

  it("should throw error with numeric values", () => {
    // @ts-expect-error - intentionally passing number to never type
    expect(() => exhaustiveCheckType(123)).toThrow(
      MSG_ERR_EXHAUSTIVE_CHECK(123 as never),
    );
  });

  it("should throw error with object values", () => {
    const obj = { key: "value" };
    // @ts-expect-error - intentionally passing object to never type
    expect(() => exhaustiveCheckType(obj)).toThrow(
      MSG_ERR_EXHAUSTIVE_CHECK(obj as never),
    );
  });

  it("should throw error with null and undefined", () => {
    // @ts-expect-error - intentionally passing null to never type
    expect(() => exhaustiveCheckType(null)).toThrow(
      MSG_ERR_EXHAUSTIVE_CHECK(null as never),
    );
    // @ts-expect-error - intentionally passing undefined to never type
    expect(() => exhaustiveCheckType(undefined)).toThrow(
      MSG_ERR_EXHAUSTIVE_CHECK(undefined as never),
    );
  });
});

describe("error message constants", () => {
  it("should format invalid type error message correctly", () => {
    expect(MSG_ERR_INVALID_TYPE("testValue")).toBe("invalid type: testValue");
    expect(MSG_ERR_INVALID_TYPE(123)).toBe("invalid type: 123");
    expect(MSG_ERR_INVALID_TYPE(null)).toBe("invalid type: null");
    expect(MSG_ERR_INVALID_TYPE(undefined)).toBe("invalid type: undefined");
  });

  it("should format exhaustive check error message correctly", () => {
    expect(MSG_ERR_EXHAUSTIVE_CHECK("testValue" as never)).toBe(
      "unresolved value: testValue",
    );
    expect(MSG_ERR_EXHAUSTIVE_CHECK(123 as never)).toBe(
      "unresolved value: 123",
    );
    expect(MSG_ERR_EXHAUSTIVE_CHECK(null as never)).toBe(
      "unresolved value: null",
    );
  });

  it("should handle complex objects in error messages", () => {
    const complexObject = { nested: { data: "value" } };
    const result = MSG_ERR_INVALID_TYPE(complexObject);

    expect(result).toBe("invalid type: [object Object]");
  });
});
