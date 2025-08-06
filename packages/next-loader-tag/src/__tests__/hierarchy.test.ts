/* eslint-disable @typescript-eslint/no-explicit-any */
import { ERR_EMPTY_TAG_ARRAY, hierarchy } from "../hierarchy";
import { tag } from "../tag";

describe("hierarchy()", () => {
  it("should create unresolved hierarchy tag object", () => {
    const tag1 = tag("category");
    const tag2 = tag("subcategory");
    const tag3 = tag("item");

    const hierarchyTag = hierarchy(tag1, tag2, tag3);

    expect(hierarchyTag.type).toBe("hierarchy");
    expect(hierarchyTag.resolved).toBe(false);
    expect(typeof hierarchyTag.resolver).toBe("function");
  });

  it("should resolve hierarchy with static tags", () => {
    const tag1 = tag("category");
    const tag2 = tag("subcategory");
    const tag3 = tag("item");

    const hierarchyTag = hierarchy(tag1, tag2, tag3);
    const resolved = hierarchyTag.resolver();

    expect(resolved.type).toBe("hierarchy");
    expect(resolved.resolved).toBe(true);
    expect(resolved.result).toEqual([
      "category",
      "category/subcategory",
      "category/subcategory/item",
    ]);
  });

  it("should create hierarchy with dynamic tags", () => {
    const categoryTag = tag((category: string) => tag(`cat-${category}`));
    const itemTag = tag((item: string) => tag(`item-${item}`));

    const hierarchyTag = hierarchy(categoryTag, itemTag);
    const resolved = hierarchyTag.resolver(["electronics"], ["laptop"]);

    expect(resolved.result).toEqual([
      "cat-electronics",
      "cat-electronics/item-laptop",
    ]);
  });

  it("should create hierarchy with mixed static and dynamic tags", () => {
    const rootTag = tag("store");
    const categoryTag = tag((category: string) => tag(category));
    const itemTag = tag("product");

    const hierarchyTag = hierarchy(rootTag, categoryTag, itemTag);
    const resolved = hierarchyTag.resolver(["books"]);

    expect(resolved.result).toEqual([
      "store",
      "store/books",
      "store/books/product",
    ]);
  });

  it("should create hierarchy with multi-parameter dynamic tags", () => {
    const orgTag = tag((org: string, region: string) =>
      tag(`${org}-${region}`),
    );
    const deptTag = tag((dept: string, team: string) => tag(`${dept}-${team}`));
    const resourceTag = tag("resource");

    const hierarchyTag = hierarchy(orgTag, deptTag, resourceTag);
    const resolved = hierarchyTag.resolver(
      ["acme", "us"],
      ["engineering", "backend"],
    );

    expect(resolved.result).toEqual([
      "acme-us",
      "acme-us/engineering-backend",
      "acme-us/engineering-backend/resource",
    ]);
  });

  it("should create hierarchy with single tag", () => {
    const singleTag = tag("root");

    const hierarchyTag = hierarchy(singleTag);
    const resolved = hierarchyTag.resolver();

    expect(resolved.result).toEqual(["root"]);
  });

  it("should throw error with empty tag array", () => {
    expect(() => {
      (hierarchy as any)();
    }).toThrow(ERR_EMPTY_TAG_ARRAY);
  });

  it("should propagate errors from dynamic tag resolvers", () => {
    const errorTag = tag((shouldError: boolean) => {
      if (shouldError) {
        throw new Error("Dynamic tag error");
      }
      return tag("success");
    });

    const hierarchyTag = hierarchy(errorTag);

    // Error case
    expect(() => hierarchyTag.resolver([true])).toThrow("Dynamic tag error");

    // Normal operation case
    const resolved = hierarchyTag.resolver([false]);
    expect(resolved.result).toEqual(["success"]);
  });

  it("should create hierarchy with empty string tags", () => {
    const rootTag = tag("");
    const childTag = tag("child");

    const hierarchyTag = hierarchy(rootTag, childTag);
    const resolved = hierarchyTag.resolver();

    expect(resolved.result).toEqual(["", "child"]);
  });

  it("should create hierarchy with identical value tags", () => {
    const tag1 = tag("same");

    const hierarchyTag = hierarchy(tag1, tag1, tag1);
    const resolved = hierarchyTag.resolver();

    expect(resolved.result).toEqual(["same", "same/same", "same/same/same"]);
  });
});
