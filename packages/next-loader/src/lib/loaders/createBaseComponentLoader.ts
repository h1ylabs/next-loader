import {
  type BackoffContextInput,
  loader as loaderCore,
  type LoaderMiddleware,
  type RetryContextInput,
  type TimeoutContextInput,
} from "@h1y/loader-core";
import type { TargetWrapper } from "@h1y/promise-aop";

import {
  ComponentStateMiddleware,
  createComponentState,
  type InitialValue,
} from "../features/componentState";
import type { ComponentFunction } from "../models/component";
import {
  type NormalizableOptions,
  normalizeOptions,
} from "../utils/normalizeOptions";

export const DEFAULT_COMPONENT_LOADER_PROPS = {
  retry: { maxCount: 0, canRetryOnError: false },
  timeout: { delay: Infinity },
} as const;

export function createBaseComponentLoader<
  Element,
  const Middlewares extends readonly LoaderMiddleware<
    Element,
    unknown,
    string
  >[],
>({
  wrapper,
  props,
  middlewares,
}: {
  readonly wrapper: (element?: Element) => TargetWrapper<Element>;
  readonly props?: ComponentLoaderProps<Element>;
  readonly middlewares?: Middlewares;
}) {
  const options = normalizeProps<Element>(props);
  const { execute, retry, loaderOptions, middlewareOptions } =
    loaderCore<Element>().withOptions({
      input: {
        retry: {
          ...options.retry,
          // The loader's fallback is different from Suspense's fallback.
          fallback: wrapper(options.retry.fallback),
        },
        timeout: options.timeout,
        backoff: options.backoff,
      },
      middlewares: [
        ComponentStateMiddleware<Element>(),
        ...(middlewares ?? []),
      ],

      // component loader does not propagate retry signals.
      propagateRetry: false,
    });

  return {
    /**
     * Higher-Order Component (HOC) that wraps a React Server Component with loader capabilities.
     *
     * @param component - The React Server Component to wrap with loader functionality
     * @returns A wrapped component that automatically handles loading states, retries, and timeouts
     *
     * @example
     * ```typescript
     * // Define your server component
     * async function MyServerComponent({ userId }: { userId: string }) {
     *   const user = await fetchUser(userId);
     *   return <div>Hello, {user.name}!</div>;
     * }
     *
     * // Wrap it with loader capabilities and export
     * const { componentLoader } = createComponentLoader();
     * export default componentLoader(MyServerComponent);
     * ```
     */
    componentLoader: <Props>(
      component: ComponentFunction<Props, Element>,
    ): ComponentFunction<Props, Element> => {
      return async (props: Props) => execute(async () => component(props));
    },

    /**
     * Manually triggers a retry for the component with an optional fallback element.
     *
     * @important This function can only be used within a server component wrapped by `componentLoader()`.
     * It has no effect on other components returned by the wrapped server component.
     *
     * @param fallback - Optional React element to display during the retry process
     *
     * @example
     * ```typescript
     * const { componentLoader, retryComponent } = createComponentLoader();
     *
     * async function MyServerComponent() {
     *   // This works - inside wrapped component
     *   retryComponent(<div>Retrying...</div>);
     *
     *   return <div>Content</div>;
     * }
     *
     * export default componentLoader(MyServerComponent);
     * ```
     */
    retryComponent: (fallback?: Element) => {
      retry(wrapper(fallback));
    },

    /**
     * Returns the current component loader configuration options.
     *
     * @important This function can only be used within a server component wrapped by `componentLoader()`.
     * It has no effect on other components returned by the wrapped server component.
     *
     * @returns Configuration object containing retry and timeout settings
     *
     * @example
     * ```typescript
     * const { componentLoader, componentOptions } = createComponentLoader();
     *
     * async function MyServerComponent() {
     *   const { retry, timeout } = componentOptions();
     *
     *   // Configure fallback for next retry
     *   retry.useFallbackOnNextRetry(<LoadingSpinner />);
     *
     *   return <div>Content</div>;
     * }
     *
     * export default componentLoader(MyServerComponent);
     * ```
     */
    componentOptions: () => {
      const { useFallbackOnNextRetry, ...retryOptions } = loaderOptions().retry;

      return {
        retry: {
          ...retryOptions,
          useFallbackOnNextRetry: (fallback: Element) => {
            useFallbackOnNextRetry(wrapper(fallback));
          },
        },
        timeout: { ...loaderOptions().timeout },
      };
    },

    /**
     * Creates and manages component state that persists across retry cycles.
     *
     * @important This function can only be used within a server component wrapped by `componentLoader()`.
     * It has no effect on other components returned by the wrapped server component.
     *
     * @param initialValue - Optional initial value for the state (can be a value or factory function)
     * @returns A tuple containing [state, setState] similar to React's useState hook
     *
     * @example
     * ```typescript
     * const { componentLoader, componentState } = createComponentLoader();
     *
     * async function MyServerComponent() {
     *   // Create state within the wrapped component (useState-like pattern)
     *   const [count, setCount] = componentState(0);
     *   const [userData, setUserData] = componentState(() => ({ name: '', email: '' }));
     *
     *   setCount(count + 1);
     *
     *   return <div>Count: {count}</div>;
     * }
     *
     * export default componentLoader(MyServerComponent);
     * ```
     */
    componentState: <T>(initialValue?: InitialValue<T>) => {
      return createComponentState(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (middlewareOptions() as any)["state"],
        initialValue,
      );
    },

    // options for each middleware
    // example. "metrics" -> metricsMiddlewareOptions()
    ...(Object.fromEntries(
      (middlewares ?? []).map(({ name }) => [
        `${name}MiddlewareOptions`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (middlewareOptions() as any)[name](),
      ]),
    ) as ComponentLoaderMiddlewareOptions<Element, Middlewares>),
  } as const;
}

export type RequiredComponentLoaderProps<Element> = {
  readonly retry: Omit<RetryContextInput<Element>, "fallback"> & {
    readonly fallback?: Element;
  };
  readonly timeout: TimeoutContextInput;
  readonly backoff?: BackoffContextInput;
};

export type ComponentLoaderProps<Element> = NormalizableOptions<
  RequiredComponentLoaderProps<Element>
>;

type ComponentLoaderMiddlewareOptions<
  Element,
  Middlewares extends readonly LoaderMiddleware<Element, unknown, string>[],
> = {
  readonly [K in Middlewares[number] as `${K["name"]}MiddlewareOptions`]: () => ReturnType<
    K["contextGenerator"]
  >;
};

function normalizeProps<Element>(
  props?: ComponentLoaderProps<Element>,
  defaultProps: RequiredComponentLoaderProps<Element> = DEFAULT_COMPONENT_LOADER_PROPS,
): RequiredComponentLoaderProps<Element> {
  return normalizeOptions(defaultProps, props);
}
