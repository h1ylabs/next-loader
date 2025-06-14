import { tag } from "../tag";

describe("tag 함수", () => {
  describe("정적 태그 생성", () => {
    it("문자열로 정적 태그를 생성할 수 있다", () => {
      const staticTag = tag("user");

      expect(staticTag.type).toBe("single");
      expect(staticTag.resolved).toBe(true);
      expect(staticTag.result).toBe("user");
    });

    it("빈 문자열로도 정적 태그를 생성할 수 있다", () => {
      const emptyTag = tag("");

      expect(emptyTag.type).toBe("single");
      expect(emptyTag.resolved).toBe(true);
      expect(emptyTag.result).toBe("");
    });
  });

  describe("동적 태그 생성", () => {
    it("resolver 함수로 동적 태그를 생성할 수 있다", () => {
      const dynamicTag = tag((id: number) => tag(`user-${id}`));

      expect(dynamicTag.type).toBe("single");
      expect(dynamicTag.resolved).toBe(false);
      expect(typeof dynamicTag.resolver).toBe("function");
    });

    it("여러 매개변수를 받는 resolver로 동적 태그를 생성할 수 있다", () => {
      const dynamicTag = tag(
        <T extends string, U extends string, V extends number>(
          namespace: T,
          id: V,
          action: U
        ) => tag(`${namespace}-${id}-${action}`)
      );
      const resolved = dynamicTag.resolver("app", 123, "click");

      expect(resolved.result).toBe("app-123-click");
    });
  });

  describe("에러 처리", () => {
    it("유효하지 않은 입력에 대해 에러를 발생시킨다", () => {
      expect(() => {
        // @ts-expect-error - 의도적으로 잘못된 타입 전달
        tag(123);
      }).toThrow(
        "Unexpected error: resolver is valid but doesn't match any known type."
      );
    });
  });
});
