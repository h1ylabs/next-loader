import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

export type AsyncErrorBoundaryProps = {
  pendingFallback?: React.ReactElement;
  errorFallback: (props: { error: unknown }) => React.ReactElement;
};

export function AsyncErrorBoundary({
  children,
  pendingFallback,
  errorFallback,
}: React.PropsWithChildren<AsyncErrorBoundaryProps>) {
  return (
    <ErrorBoundary fallbackRender={errorFallback}>
      <Suspense fallback={pendingFallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
