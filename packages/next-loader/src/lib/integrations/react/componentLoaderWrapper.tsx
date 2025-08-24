import type { TargetWrapper } from "@h1y/promise-aop";
import { Suspense } from "react";

export function ReactComponentLoaderWrapper(
  element?: React.ReactElement,
): TargetWrapper<React.ReactElement> {
  return (OriginalElement) =>
    async function RetryComponent() {
      return (
        <Suspense fallback={element}>
          <OriginalElement />
        </Suspense>
      );
    };
}
