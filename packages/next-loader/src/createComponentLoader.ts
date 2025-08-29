import { ReactComponentLoaderWrapper } from "./lib/integrations/react/componentLoaderWrapper";
import { ReactComponentLoaderMiddleware } from "./lib/integrations/react/types";
import {
  withBoundary,
  withErrorBoundary,
} from "./lib/integrations/react/withBoundary";
import {
  type ComponentLoaderProps,
  createBaseComponentLoader,
} from "./lib/loaders/createBaseComponentLoader";
import { ComponentFunction } from "./lib/models/component";
import { AsyncErrorBoundaryProps } from "./lib/utils/AsyncErrorBoundary";

export function createComponentLoader<
  const Middlewares extends readonly ReactComponentLoaderMiddleware[],
>(props?: ComponentLoaderProps<React.ReactElement>, middlewares?: Middlewares) {
  const { componentLoader: baseComponentLoader, ...others } =
    createBaseComponentLoader<React.ReactElement, Middlewares>({
      wrapper: ReactComponentLoaderWrapper,
      props,
      middlewares,
    });

  const componentLoader = <Props extends object>(
    component: ComponentFunction<Props, React.ReactElement>,
  ) => {
    const AsyncComponent = baseComponentLoader<Props>(component);

    return {
      // returns the async component with resilience logic applied.
      withNoBoundary: () => AsyncComponent,

      // creates a suspense boundary to enable independent code-splitting.
      withBoundary: (fallback?: React.ReactElement) => {
        return withBoundary(AsyncComponent, fallback);
      },

      // handles errors within the boundary as well.
      withErrorBoundary: (errorBoundaryProps: AsyncErrorBoundaryProps) => {
        return withErrorBoundary(AsyncComponent, errorBoundaryProps);
      },
    } as const;
  };

  return { componentLoader, ...others } as const;
}
