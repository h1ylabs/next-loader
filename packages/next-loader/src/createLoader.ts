import { LoaderMiddleware } from "@h1y/loader-core";

import {
  createBaseLoader,
  LoaderDependencies,
  LoaderProps,
} from "./lib/loaders/createBaseLoader";

/**
 * Creates a data loader for fetching and caching resources with revalidation support.
 * Returns a loader function that can handle multiple resources in parallel with caching and server actions.
 *
 * @param dependencies - Required dependencies including adapter and optional memo/revalidate functions
 * @param props - Optional configuration for retry behavior and timeout settings
 * @param middlewares - Optional array of middlewares to apply to the loader
 * @returns Object containing loader function for creating load/revalidate pairs
 *
 * @example
 * ```typescript
 * // Setup dependencies (usually at app level)
 * const dependencies = {
 *   adapter: NextJSAdapter,
 *   revalidate: revalidateTag,
 *   memo: cache // Next.js cache for request deduplication
 * };
 *
 * // In server component
 * async function UserProfilePage({ userId }: { userId: string }) {
 *   const { loader } = createLoader(dependencies, {
 *     retry: { maxCount: 2 },
 *     timeout: { delay: 10000 }
 *   });
 *
 *   const [load, revalidate] = loader(
 *     User({ id: userId }),
 *     Posts({ authorId: userId })
 *   );
 *
 *   const [userData, postsData] = await load();
 *
 *   return (
 *     <div>
 *       <h1>{userData.name}</h1>
 *       <PostsList posts={postsData} />
 *       <form action={revalidate}>
 *         <button type="submit">Refresh Data</button>
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 */
export function createLoader<
  LoaderParam,
  const Middlewares extends readonly LoaderMiddleware<
    unknown,
    unknown,
    string
  >[],
>(
  dependencies: LoaderDependencies<LoaderParam>,
  props?: LoaderProps,
  middlewares?: Middlewares,
) {
  return createBaseLoader({
    props,
    middlewares,
    dependencies,
  });
}
