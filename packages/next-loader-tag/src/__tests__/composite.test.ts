/* eslint-disable @typescript-eslint/no-explicit-any */
import { compose, ERR_EMPTY_TAG_ARRAY } from "@/compose";
import { tag } from "@/tag";

describe("compose()", () => {
  it("should create unresolved composite tag object", () => {
    const tag1 = tag("user");
    const tag2 = tag("profile");
    const tag3 = tag("view");

    const compositeTag = compose(tag1, tag2, tag3);

    expect(compositeTag.type).toBe("composite");
    expect(compositeTag.resolved).toBe(false);
    expect(typeof compositeTag.resolver).toBe("function");
  });

  it("should resolve composite with static tags", () => {
    const tag1 = tag("user");
    const tag2 = tag("profile");

    const compositeTag = compose(tag1, tag2);
    const resolved = compositeTag.resolver();

    expect(resolved.type).toBe("composite");
    expect(resolved.resolved).toBe(true);
    expect(resolved.result).toBe("user_profile");
  });

  it("should create composite with dynamic tags", () => {
    const userTag = tag((id: number) => tag(`user-${id}`));
    const actionTag = tag(<T extends string>(action: T) =>
      tag(`action-${action}`),
    );

    const compositeTag = compose(userTag, actionTag);
    const resolved = compositeTag.resolver([123], ["click"]);

    expect(resolved.result).toBe("user-123_action-click");
  });

  it("should create composite with mixed static and dynamic tags", () => {
    const staticTag = tag("app");
    const dynamicTag = tag((id: number) => tag(`user-${id}`));
    const staticTag2 = tag("dashboard");

    const compositeTag = compose(staticTag, dynamicTag, staticTag2);
    const resolved = compositeTag.resolver([456]);

    expect(resolved.result).toBe("app_user-456_dashboard");
  });

  it("should create composite with multi-parameter dynamic tags", () => {
    const userTag = tag(<T extends string>(namespace: T, id: number) =>
      tag(`${namespace}-${id}`),
    );
    const actionTag = tag(<T extends string>(action: T, timestamp: number) =>
      tag(`${action}-${timestamp}`),
    );

    const compositeTag = compose(userTag, actionTag);
    const resolved = compositeTag.resolver(["app", 123], ["click", 1234567890]);

    expect(resolved.result).toBe("app-123_click-1234567890");
  });

  it("should create composite with single tag", () => {
    const singleTag = tag("standalone");

    const compositeTag = compose(singleTag);
    const resolved = compositeTag.resolver();

    expect(resolved.result).toBe("standalone");
  });

  it("should throw error with empty tag array", () => {
    expect(() => {
      (compose as any)();
    }).toThrow(ERR_EMPTY_TAG_ARRAY);
  });

  it("should propagate errors from dynamic tag resolvers", () => {
    const errorTag = tag((shouldError: boolean) => {
      if (shouldError) {
        throw new Error("Dynamic tag error");
      }
      return tag("success");
    });

    const compositeTag = compose(errorTag);

    // Error case
    expect(() => compositeTag.resolver([true])).toThrow("Dynamic tag error");

    // Normal operation case
    const resolved = compositeTag.resolver([false]);
    expect(resolved.result).toBe("success");
  });
});
