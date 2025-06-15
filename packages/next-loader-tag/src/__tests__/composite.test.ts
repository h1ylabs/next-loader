/* eslint-disable @typescript-eslint/no-explicit-any */
import { compose } from "../compose";
import { tag } from "../tag";

describe("composite 함수", () => {
  describe("기본 기능", () => {
    it("정적 태그들을 조합할 수 있다", () => {
      const tag1 = tag("user");
      const tag2 = tag("profile");
      const tag3 = tag("view");

      const compositeTag = compose(tag1, tag2, tag3);

      expect(compositeTag.type).toBe("composite");
      expect(compositeTag.resolved).toBe(false);
      expect(typeof compositeTag.resolver).toBe("function");
    });

    it("정적 태그들을 조합하여 해결할 수 있다", () => {
      const tag1 = tag("user");
      const tag2 = tag("profile");

      const compositeTag = compose(tag1, tag2);
      const resolved = compositeTag.resolver();

      expect(resolved.type).toBe("composite");
      expect(resolved.resolved).toBe(true);
      expect(resolved.result).toBe("user_profile");
    });

    it("동적 태그들을 조합할 수 있다", () => {
      const userTag = tag((id: number) => tag(`user-${id}`));
      const actionTag = tag(<T extends string>(action: T) =>
        tag(`action-${action}`),
      );

      const compositeTag = compose(userTag, actionTag);
      const resolved = compositeTag.resolver([123], ["click"]);

      expect(resolved.result).toBe("user-123_action-click");
    });

    it("정적 태그와 동적 태그를 혼합하여 조합할 수 있다", () => {
      const staticTag = tag("app");
      const dynamicTag = tag((id: number) => tag(`user-${id}`));
      const staticTag2 = tag("dashboard");

      const compositeTag = compose(staticTag, dynamicTag, staticTag2);
      const resolved = compositeTag.resolver([456]);

      expect(resolved.result).toBe("app_user-456_dashboard");
    });
  });

  describe("복잡한 시나리오", () => {
    it("여러 매개변수를 받는 동적 태그들을 조합할 수 있다", () => {
      const userTag = tag(<T extends string>(namespace: T, id: number) =>
        tag(`${namespace}-${id}`),
      );
      const actionTag = tag(<T extends string>(action: T, timestamp: number) =>
        tag(`${action}-${timestamp}`),
      );

      const compositeTag = compose(userTag, actionTag);
      const resolved = compositeTag.resolver(
        ["app", 123],
        ["click", 1234567890],
      );

      expect(resolved.result).toBe("app-123_click-1234567890");
    });

    it("단일 태그도 조합할 수 있다", () => {
      const singleTag = tag("standalone");

      const compositeTag = compose(singleTag);
      const resolved = compositeTag.resolver();

      expect(resolved.result).toBe("standalone");
    });

    it("Generic을 활용한 정확한 타입 추론 테스트", () => {
      const roleTag = tag(<T extends string>(role: T) => tag(`role:${role}`));
      const actionTag = tag(<T extends string>(action: T) =>
        tag(`action:${action}`),
      );

      const compositeTag = compose(roleTag, actionTag);
      const resolved = compositeTag.resolver(["admin"], ["login"]);

      expect(resolved.result).toBe("role:admin_action:login");
    });
  });

  describe("에러 처리", () => {
    it("빈 태그 배열로 조합을 시도하면 에러가 발생한다", () => {
      expect(() => {
        (compose as any)();
      }).toThrow("Error: at least a single tag required.");
    });

    it("동적 태그의 resolver가 실행 중 에러를 발생시키면 전파된다", () => {
      const errorTag = tag((shouldError: boolean) => {
        if (shouldError) {
          throw new Error("Dynamic tag error");
        }
        return tag("success");
      });

      const compositeTag = compose(errorTag);

      // 에러가 발생하는 경우
      expect(() => compositeTag.resolver([true])).toThrow("Dynamic tag error");

      // 정상 동작하는 경우
      const resolved = compositeTag.resolver([false]);
      expect(resolved.result).toBe("success");
    });
  });

  describe("실제 사용 시나리오", () => {
    it("사용자 액션 추적 태그를 구성할 수 있다", () => {
      const appTag = tag("myapp");
      const userTag = tag((userId: number) => tag(`user-${userId}`));
      const actionTag = tag(<T extends string>(action: T) =>
        tag(`action-${action}`),
      );

      const trackingTag = compose(appTag, userTag, actionTag);
      const resolved = trackingTag.resolver([123], ["button-click"]);

      expect(resolved.result).toBe("myapp_user-123_action-button-click");
    });

    it("계층적 네임스페이스 태그 구성", () => {
      const orgTag = tag(<T extends string>(orgId: T) => tag(`org:${orgId}`));
      const projectTag = tag(<T extends string>(projectId: T) =>
        tag(`project:${projectId}`),
      );
      const resourceTag = tag("resource");

      const resourcePathTag = compose(orgTag, projectTag, resourceTag);
      const resolved = resourcePathTag.resolver(["acme"], ["web-app"]);

      expect(resolved.result).toBe("org:acme_project:web-app_resource");
    });
  });
});
