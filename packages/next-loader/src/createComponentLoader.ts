import { ReactComponentLoaderWrapper } from "./lib/integrations/react/componentLoaderWrapper";
import { ReactComponentLoaderMiddleware } from "./lib/integrations/react/types";
import {
  type ComponentLoaderProps,
  createBaseComponentLoader,
} from "./lib/loaders/createBaseComponentLoader";

/**
 * Creates a component loader that wraps React Server Components with loading capabilities.
 * Provides retry logic, timeout handling, and state management for server components.
 *
 * @param props - Configuration for retry behavior, timeout, and fallback components
 * @param middlewares - Optional array of middlewares to apply to the component loader
 * @returns Object containing componentLoader HOC and utility functions (retryComponent, componentOptions, componentState)
 *
 * @example
 * ```typescript
 * // Basic usage with retry and timeout
 * const { componentLoader } = createComponentLoader({
 *   retry: { maxCount: 3, fallback: <div>Loading...</div> },
 *   timeout: { delay: 5000 }
 * });
 *
 * // Define your server component separately
 * async function UserProfile({ userId }) {
 *   const user = await fetchUser(userId);
 *   return <div>Hello, {user.name}!</div>;
 * }
 *
 * // Wrap the component with the loader
 * export default componentLoader(UserProfile);
 * ```
 */
export function createComponentLoader<
  const Middlewares extends readonly ReactComponentLoaderMiddleware[],
>(props?: ComponentLoaderProps<React.ReactElement>, middlewares?: Middlewares) {
  return createBaseComponentLoader<React.ReactElement, Middlewares>({
    wrapper: ReactComponentLoaderWrapper,
    props,
    middlewares,
  });
}
