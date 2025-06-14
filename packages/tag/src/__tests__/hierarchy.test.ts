/* eslint-disable @typescript-eslint/no-explicit-any */
import { hierarchy } from "../hierarchy";
import { tag } from "../tag";

describe("hierarchy 함수", () => {
  describe("기본 기능", () => {
    it("정적 태그들을 계층적으로 조합할 수 있다", () => {
      const tag1 = tag("category");
      const tag2 = tag("subcategory");
      const tag3 = tag("item");

      const hierarchyTag = hierarchy(tag1, tag2, tag3);

      expect(hierarchyTag.type).toBe("hierarchy");
      expect(hierarchyTag.resolved).toBe(false);
      expect(typeof hierarchyTag.resolver).toBe("function");
    });

    it("정적 태그들을 계층적으로 조합하여 해결할 수 있다", () => {
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

    it("동적 태그들을 계층적으로 조합할 수 있다", () => {
      const categoryTag = tag((category: string) => tag(`cat-${category}`));
      const itemTag = tag((item: string) => tag(`item-${item}`));

      const hierarchyTag = hierarchy(categoryTag, itemTag);
      const resolved = hierarchyTag.resolver(["electronics"], ["laptop"]);

      expect(resolved.result).toEqual([
        "cat-electronics",
        "cat-electronics/item-laptop",
      ]);
    });

    it("정적 태그와 동적 태그를 혼합하여 계층 구성할 수 있다", () => {
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
  });

  describe("복잡한 시나리오", () => {
    it("여러 매개변수를 받는 동적 태그들을 계층 구성할 수 있다", () => {
      const orgTag = tag((org: string, region: string) =>
        tag(`${org}-${region}`)
      );
      const deptTag = tag((dept: string, team: string) =>
        tag(`${dept}-${team}`)
      );
      const resourceTag = tag("resource");

      const hierarchyTag = hierarchy(orgTag, deptTag, resourceTag);
      const resolved = hierarchyTag.resolver(
        ["acme", "us"],
        ["engineering", "backend"]
      );

      expect(resolved.result).toEqual([
        "acme-us",
        "acme-us/engineering-backend",
        "acme-us/engineering-backend/resource",
      ]);
    });

    it("단일 태그도 계층 구조로 처리할 수 있다", () => {
      const singleTag = tag("root");

      const hierarchyTag = hierarchy(singleTag);
      const resolved = hierarchyTag.resolver();

      expect(resolved.result).toEqual(["root"]);
    });

    it("두 개의 태그로 계층 구조를 만들 수 있다", () => {
      const parentTag = tag("parent");
      const childTag = tag((child: string) => tag(child));

      const hierarchyTag = hierarchy(parentTag, childTag);
      const resolved = hierarchyTag.resolver(["child"]);

      expect(resolved.result).toEqual(["parent", "parent/child"]);
    });

    it("Generic을 활용한 정확한 타입 추론 테스트", () => {
      const namespaceTag = tag((ns: string) => tag(`ns:${ns}`));
      const serviceTag = tag((service: string) => tag(`service:${service}`));
      const versionTag = tag((version: string) => tag(`v${version}`));

      const hierarchyTag = hierarchy(namespaceTag, serviceTag, versionTag);
      const resolved = hierarchyTag.resolver(
        ["production"],
        ["api"],
        ["2.1.0"]
      );

      expect(resolved.result).toEqual([
        "ns:production",
        "ns:production/service:api",
        "ns:production/service:api/v2.1.0",
      ]);
    });
  });

  describe("에러 처리", () => {
    it("빈 태그 배열로 계층 구성을 시도하면 에러가 발생한다", () => {
      expect(() => {
        (hierarchy as any)();
      }).toThrow("Error: at least a single tag required.");
    });

    it("동적 태그의 resolver가 실행 중 에러를 발생시키면 전파된다", () => {
      const errorTag = tag((shouldError: boolean) => {
        if (shouldError) {
          throw new Error("Dynamic tag error");
        }
        return tag("success");
      });

      const hierarchyTag = hierarchy(errorTag);

      // 에러가 발생하는 경우
      expect(() => hierarchyTag.resolver([true])).toThrow("Dynamic tag error");

      // 정상 동작하는 경우
      const resolved = hierarchyTag.resolver([false]);
      expect(resolved.result).toEqual(["success"]);
    });

    it("잘못된 태그가 포함된 경우 에러를 발생시킨다", () => {
      const validTag = tag("valid");
      const invalidTag = { type: "single", resolved: false } as any; // resolver 없음

      const hierarchyTag = hierarchy(validTag, invalidTag);

      expect(() => hierarchyTag.resolver()).toThrow("Invalid tag at index 1");
    });
  });

  describe("실제 사용 시나리오", () => {
    it("파일 시스템 경로 구조를 생성할 수 있다", () => {
      const rootTag = tag("home");
      const userTag = tag((username: string) => tag(username));
      const folderTag = tag("documents");
      const fileTag = tag((filename: string) => tag(filename));

      const pathTag = hierarchy(rootTag, userTag, folderTag, fileTag);
      const resolved = pathTag.resolver(["john"], ["report.pdf"]);

      expect(resolved.result).toEqual([
        "home",
        "home/john",
        "home/john/documents",
        "home/john/documents/report.pdf",
      ]);
    });

    it("URL 경로 구조를 생성할 수 있다", () => {
      const domainTag = tag("api.example.com");
      const versionTag = tag("v1");
      const resourceTag = tag((resource: string) => tag(resource));
      const idTag = tag((id: number) => tag(id.toString()));

      const urlTag = hierarchy(domainTag, versionTag, resourceTag, idTag);
      const resolved = urlTag.resolver(["users"], [123]);

      expect(resolved.result).toEqual([
        "api.example.com",
        "api.example.com/v1",
        "api.example.com/v1/users",
        "api.example.com/v1/users/123",
      ]);
    });

    it("네임스페이스 기반 리소스 경로 구성", () => {
      const clusterTag = tag((cluster: string) => tag(cluster));
      const namespaceTag = tag((namespace: string) => tag(namespace));
      const typeTag = tag("deployment");
      const nameTag = tag((name: string) => tag(name));

      const resourcePathTag = hierarchy(
        clusterTag,
        namespaceTag,
        typeTag,
        nameTag
      );
      const resolved = resourcePathTag.resolver(
        ["prod-cluster"],
        ["backend"],
        ["api-server"]
      );

      expect(resolved.result).toEqual([
        "prod-cluster",
        "prod-cluster/backend",
        "prod-cluster/backend/deployment",
        "prod-cluster/backend/deployment/api-server",
      ]);
    });

    it("조직 구조 계층을 생성할 수 있다", () => {
      const companyTag = tag("company");
      const divisionTag = tag((division: string) => tag(division));
      const departmentTag = tag((dept: string) => tag(dept));
      const teamTag = tag((team: string) => tag(team));

      const orgTag = hierarchy(companyTag, divisionTag, departmentTag, teamTag);
      const resolved = orgTag.resolver(
        ["engineering"],
        ["backend"],
        ["api-team"]
      );

      expect(resolved.result).toEqual([
        "company",
        "company/engineering",
        "company/engineering/backend",
        "company/engineering/backend/api-team",
      ]);
    });
  });

  describe("엣지 케이스", () => {
    it("빈 문자열 태그도 계층에 포함할 수 있다", () => {
      const rootTag = tag("");
      const childTag = tag("child");

      const hierarchyTag = hierarchy(rootTag, childTag);
      const resolved = hierarchyTag.resolver();

      expect(resolved.result).toEqual(["", "child"]);
    });

    it("동일한 값을 가진 태그들을 계층 구성할 수 있다", () => {
      const tag1 = tag("same");
      const tag2 = tag("same");
      const tag3 = tag("same");

      const hierarchyTag = hierarchy(tag1, tag2, tag3);
      const resolved = hierarchyTag.resolver();

      expect(resolved.result).toEqual(["same", "same/same", "same/same/same"]);
    });
  });
});
