import type { Loader } from "./types/loader";
import type { Resource } from "./types/resource";

type ExtractResults<T extends Resource[]> = T extends [infer U, ...infer V]
  ? U extends Resource<infer W>
    ? V extends Resource[]
      ? [W, ...ExtractResults<V>]
      : never
    : never
  : T extends Resource<infer W>[]
    ? W[]
    : [];

/**
 * loader 구현체를 생성합니다.
 */
export default function configureLoader({
  fetch,
  revalidate: revalidateAction,
}: Loader) {
  return function loader<T extends Resource[]>(
    ...resources: T
  ): [() => Promise<ExtractResults<T>>, () => Promise<void>] {
    // 재검증 대상인 Tag 각각에 대응하는 고유 값으로 매핑합니다.
    const signatures = Promise.all(
      resources
        .map((resource) =>
          resource.tags.current.map((tag) => resource.__signatures[tag]!),
        )
        .flat(),
    );

    async function load() {
      return Promise.all(
        resources.map((resource) => resource.load(fetch)),
      ) as Promise<ExtractResults<T>>;
    }

    async function revalidate() {
      "use server";
      revalidateAction(await signatures);
    }

    return [load, revalidate];
  };
}
