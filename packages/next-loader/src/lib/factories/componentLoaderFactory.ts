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
import { DEFAULT_COMPONENT_LOADER_PROPS } from "../models/loader";
import {
  type NormalizableOptions,
  normalizeOptions,
} from "../utils/normalizeOptions";

export function componentLoaderFactory<
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
  const {
    execute,
    retryFallback,
    retryImmediately,
    loaderOptions,
    middlewareOptions,
  } = loaderCore<Element>().withOptions({
    input: {
      retry: {
        ...options.retry,
        onRetryEach() {
          // from props
          props?.retry?.onRetryEach?.();

          // determine retry fallback
          // PRIORITY: initial < retryFallback < retryImmediately
        },
        // the loader's fallback is different from Suspense's fallback.
        fallback: wrapper(options.retry.fallback),
      },
      timeout: options.timeout,
      backoff: options.backoff,
    },
    middlewares: [ComponentStateMiddleware<Element>(), ...(middlewares ?? [])],

    // component loader does not propagate retry signals.
    propagateRetry: false,
    // determineError, handleError
  });

  return {
    componentLoader: <Props extends object>(
      component: ComponentFunction<Props, Element>,
    ): ComponentFunction<Props, Element> => {
      return async (props: Props) => execute(async () => component(props));
    },

    retryImmediately: (fallback?: Element) => {
      retryImmediately(wrapper(fallback));
    },

    retryFallback: <T>({
      when,
      fallback,
    }: {
      readonly when: (error: T) => boolean;
      readonly fallback: (error: T) => Element;
    }) => {
      retryFallback<T>({ when, fallback: (error) => wrapper(fallback(error)) });
    },

    componentOptions: () => {
      return {
        retry: { ...loaderOptions().retry },
        timeout: { ...loaderOptions().timeout },
      };
    },

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
