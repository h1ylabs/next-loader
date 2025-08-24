import { ResourceAdapter } from "../models/resourceAdapter";

/**
 * Helper function for creating resource adapters with type safety.
 * Provides a standardized way to create custom adapters that handle resource fetching.
 *
 * @param adapter - The adapter function that defines how to fetch resources
 * @returns The same adapter function with proper typing
 *
 * @example
 * ```typescript
 * // Create a custom HTTP adapter
 * const HttpAdapter = createResourceAdapter<string>(({ tags, options }) => {
 *   return async (url: string) => {
 *     const response = await fetch(url, {
 *       headers: {
 *         'Cache-Control': `max-age=${options.staleTime || 0}`,
 *         'X-Cache-Tags': tags.join(',')
 *       }
 *     });
 *     return response.json();
 *   };
 * });
 *
 * // Create a database adapter
 * const DatabaseAdapter = createResourceAdapter<{ table: string; id: string }>(
 *   ({ tags, options }) => {
 *     return async ({ table, id }) => {
 *       return db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
 *     };
 *   }
 * );
 *
 * // Use with loader
 * const dependencies = {
 *   adapter: HttpAdapter, // or DatabaseAdapter
 *   revalidate: customRevalidateFunction
 * };
 * ```
 */
export function createResourceAdapter<T>(adapter: ResourceAdapter<T>) {
  return adapter;
}
