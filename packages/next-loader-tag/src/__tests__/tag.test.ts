import { ERR_TAG_INVALID_INPUT, tag } from "@/tag";

describe("tag()", () => {
  it("should create static tag with string value", () => {
    const staticTag = tag("user");

    expect(staticTag.type).toBe("single");
    expect(staticTag.resolved).toBe(true);
    expect(staticTag.result).toBe("user");
  });

  it("should create static tag with empty string", () => {
    const emptyTag = tag("");

    expect(emptyTag.type).toBe("single");
    expect(emptyTag.resolved).toBe(true);
    expect(emptyTag.result).toBe("");
  });

  it("should create and resolve dynamic tag with single parameter", () => {
    const dynamicTag = tag(<T extends number>(id: T) => tag(`user-${id}`));

    expect(dynamicTag.type).toBe("single");
    expect(dynamicTag.resolved).toBe(false);
    expect(typeof dynamicTag.resolver).toBe("function");

    const resolved = dynamicTag.resolver(123);
    expect(resolved.type).toBe("single");
    expect(resolved.resolved).toBe(true);
    expect(resolved.result).toBe("user-123");
  });

  it("should create dynamic tag with multiple parameter resolver", () => {
    const dynamicTag = tag(
      <T extends string, U extends string, V extends number>(
        namespace: T,
        id: V,
        action: U,
      ) => tag(`${namespace}-${id}-${action}`),
    );
    const resolved = dynamicTag.resolver("app", 123, "click");

    expect(resolved.type).toBe("single");
    expect(resolved.resolved).toBe(true);
    expect(resolved.result).toBe("app-123-click");
  });

  it("should handle various string formats in static tags", () => {
    const specialTag = tag("user@domain.com/path?query=1#hash");
    expect(specialTag.result).toBe("user@domain.com/path?query=1#hash");

    const unicodeTag = tag("사용자-123-🚀");
    expect(unicodeTag.result).toBe("사용자-123-🚀");
  });

  it("should create dynamic tag with different parameter types", () => {
    // Boolean parameter
    const booleanTag = tag((isActive: boolean) =>
      tag(isActive ? "active" : "inactive"),
    );
    expect(booleanTag.resolver(true).result).toBe("active");
    expect(booleanTag.resolver(false).result).toBe("inactive");

    // Array parameter
    const arrayTag = tag((items: string[]) => tag(items.join("-")));
    expect(arrayTag.resolver(["a", "b", "c"]).result).toBe("a-b-c");

    // Object parameter
    const objectTag = tag((user: { id: number; name: string }) =>
      tag(`${user.name}-${user.id}`),
    );
    expect(objectTag.resolver({ id: 123, name: "john" }).result).toBe(
      "john-123",
    );
  });

  it("should propagate errors from resolver function", () => {
    const errorTag = tag((shouldError: boolean) => {
      if (shouldError) {
        throw new Error("Resolver error");
      }
      return tag("success");
    });

    expect(() => errorTag.resolver(true)).toThrow("Resolver error");
    expect(errorTag.resolver(false).result).toBe("success");
  });

  it("should throw error for invalid input types", () => {
    const invalidInputs = [123, null, undefined, [], {}];

    invalidInputs.forEach((input) => {
      expect(() => {
        // @ts-expect-error - 의도적으로 잘못된 타입 전달
        tag(input);
      }).toThrow(ERR_TAG_INVALID_INPUT);
    });
  });

  it("should create identical static tags with same value", () => {
    const tag1 = tag("same");
    const tag2 = tag("same");

    expect(tag1.result).toBe(tag2.result);
    expect(tag1.type).toBe(tag2.type);
    expect(tag1.resolved).toBe(tag2.resolved);
  });

  it("should create dynamic tag with no parameters", () => {
    let counter = 0;
    const counterTag = tag(() => tag(`count-${++counter}`));

    const resolved1 = counterTag.resolver();
    expect(resolved1.result).toBe("count-1");

    const resolved2 = counterTag.resolver();
    expect(resolved2.result).toBe("count-2");
  });
});
