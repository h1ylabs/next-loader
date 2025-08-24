import { createResourceAdapter } from "../../features/createResourceAdapter";

export const NEXTJS_FETCH_MAX_TAGS = 128;
export const NEXTJS_FETCH_MAX_TAG_LENGTH = 256;

/**
 * Pre-configured adapter for Next.js applications using fetch API with cache tags.
 * Handles Next.js cache constraints (max 128 tags, 256 chars per tag) and revalidation.
 * Integrates seamlessly with Next.js caching system and revalidateTag functionality.
 *
 * @example
 * ```typescript
 * import { revalidateTag } from 'next/cache';
 * import { cache } from 'react';
 *
 * // Setup dependencies for Next.js app
 * const dependencies = {
 *   adapter: NextJSAdapter,
 *   revalidate: revalidateTag,
 *   memo: cache // Request deduplication
 * };
 *
 * // Use with loader in server component
 * async function UserPage({ id }: { id: string }) {
 *   const { loader } = createLoader(dependencies);
 *   const [load] = loader(User({ id }));
 *   const userData = await load();
 *
 *   return <div>Hello, {userData.name}!</div>;
 * }
 *
 * // Resource builder that works with NextJSAdapter
 * const User = createResourceBuilder({
 *   tags: ({ id }) => ({ identifier: `user-${id}` }),
 *   options: { staleTime: 300 }, // 5 minutes cache
 *   use: [],
 *   load: async ({ req, fetch }) => {
 *     // fetch parameter will be the URL string
 *     const response = await fetch(`/api/users/${req.id}`);
 *     return response.json();
 *   }
 * });
 * ```
 *
 * @throws {Error} When more than 128 tags are provided
 * @throws {Error} When any tag exceeds 256 characters
 */
export const NextJSAdapter = createResourceAdapter<string>(
  ({ tags, options }) => {
    // resource tag constraints
    // 1. next.js fetch can specify up to 128 tags
    if (tags.length > NEXTJS_FETCH_MAX_TAGS) {
      throw new Error(MSG_ERR_INVALID_TAGS);
    }

    // 2. each tag has a limit of 256 characters
    if (tags.some((tag) => tag.length > NEXTJS_FETCH_MAX_TAG_LENGTH)) {
      throw new Error(MSG_ERR_INVALID_TAG_LENGTH);
    }

    return async (data) =>
      fetch(data, {
        next: { revalidate: options.staleTime, tags: [...tags] },
      });
  },
);

export const MSG_ERR_INVALID_TAGS = "invalid tags: must be less than 128 tags.";
export const MSG_ERR_INVALID_TAG_LENGTH =
  "invalid tag length: each tag must be 256 characters or less.";
