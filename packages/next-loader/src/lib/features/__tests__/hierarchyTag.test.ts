import {
  hierarchyTag,
  MSG_ERR_HIERARCHY_EMPTY_TAG_ARRAY,
} from "@/lib/features/hierarchyTag";

describe("hierarchy()", () => {
  describe("basic functionality", () => {
    it("should create hierarchy with single tag", () => {
      const result = hierarchyTag("user");

      expect(result).toEqual(["user"]);
    });

    it("should create hierarchy with two tags", () => {
      const result = hierarchyTag("user", "profile");

      expect(result).toEqual(["user", "user/profile"]);
    });

    it("should create hierarchy with three tags", () => {
      const result = hierarchyTag("user", "posts", "comments");

      expect(result).toEqual(["user", "user/posts", "user/posts/comments"]);
    });

    it("should handle complex paths with slashes", () => {
      const result = hierarchyTag("user", "posts/123", "comments/12345");

      expect(result).toEqual([
        "user",
        "user/posts/123",
        "user/posts/123/comments/12345",
      ]);
    });

    it("should handle many tags", () => {
      const result = hierarchyTag("org", "team", "user", "project", "task");

      expect(result).toEqual([
        "org",
        "org/team",
        "org/team/user",
        "org/team/user/project",
        "org/team/user/project/task",
      ]);
    });
  });

  describe("edge cases", () => {
    it("should throw error with empty tag array", () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (hierarchyTag as any)();
      }).toThrow(MSG_ERR_HIERARCHY_EMPTY_TAG_ARRAY);
    });

    it("should handle empty string tags", () => {
      const result = hierarchyTag("", "user");

      expect(result).toEqual(["", "user"]);
    });

    it("should handle all empty string tags", () => {
      const result = hierarchyTag("", "", "");

      expect(result).toEqual(["", "", ""]);
    });

    it("should handle tags with special characters", () => {
      const result = hierarchyTag(
        "user@domain.com",
        "posts#123",
        "comments?sort=date",
      );

      expect(result).toEqual([
        "user@domain.com",
        "user@domain.com/posts#123",
        "user@domain.com/posts#123/comments?sort=date",
      ]);
    });

    it("should handle identical tags", () => {
      const result = hierarchyTag("same", "same", "same");

      expect(result).toEqual(["same", "same/same", "same/same/same"]);
    });

    it("should handle tags with spaces", () => {
      const result = hierarchyTag("user name", "post title", "comment text");

      expect(result).toEqual([
        "user name",
        "user name/post title",
        "user name/post title/comment text",
      ]);
    });

    it("should handle unicode characters", () => {
      const result = hierarchyTag("사용자", "게시물", "댓글");

      expect(result).toEqual(["사용자", "사용자/게시물", "사용자/게시물/댓글"]);
    });
  });

  describe("type safety", () => {
    it("should maintain correct TypeScript types", () => {
      // Test that the function returns the correct typed array
      const result = hierarchyTag("a", "b", "c");

      // TypeScript should infer this as [string, string, string]
      expect(result).toHaveLength(3);
      expect(typeof result[0]).toBe("string");
      expect(typeof result[1]).toBe("string");
      expect(typeof result[2]).toBe("string");
    });

    it("should work with readonly arrays", () => {
      const tags = ["user", "profile"] as const;
      const result = hierarchyTag(...tags);

      expect(result).toEqual(["user", "user/profile"]);
    });
  });

  describe("performance and edge limits", () => {
    it("should handle large number of tags efficiently", () => {
      const tags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (hierarchyTag as any)(...tags);

      expect(result).toHaveLength(100);
      expect(result[0]).toBe("tag0");
      expect(result[99]).toBe(tags.slice(0, 100).join("/"));
    });

    it("should handle very long tag names", () => {
      const longTag = "a".repeat(1000);
      const result = hierarchyTag("short", longTag, "end");

      expect(result).toEqual([
        "short",
        `short/${longTag}`,
        `short/${longTag}/end`,
      ]);
    });
  });
});
