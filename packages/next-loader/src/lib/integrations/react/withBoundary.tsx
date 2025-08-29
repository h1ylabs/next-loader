import { Suspense } from "react";

import {
  AsyncErrorBoundary,
  type AsyncErrorBoundaryProps,
} from "../../utils/AsyncErrorBoundary";

export function withBoundary<Props extends object>(
  AsyncComponent: (props: Props) => Promise<React.ReactElement>,
  fallback?: React.ReactElement,
) {
  return async function Component(props: Props) {
    return (
      <Suspense fallback={fallback}>
        <AsyncComponent {...props} />
      </Suspense>
    );
  };
}

export function withErrorBoundary<Props extends object>(
  AsyncComponent: (props: Props) => Promise<React.ReactElement>,
  errorBoundaryProps: AsyncErrorBoundaryProps,
) {
  return async function Component(props: Props) {
    return (
      <AsyncErrorBoundary {...errorBoundaryProps}>
        <AsyncComponent {...props} />
      </AsyncErrorBoundary>
    );
  };
}
