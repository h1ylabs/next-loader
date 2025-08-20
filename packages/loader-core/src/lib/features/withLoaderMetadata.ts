import { AsyncContext } from "@h1y/promise-aop";

import { LoaderMetadata, type LoaderRetryPropagation } from "../models/loader";

export function withLoaderMetadata<T>(id: string, fn: () => Promise<T>) {
  const metadata: LoaderMetadata = { hierarchy: [] };

  try {
    const currentContext = LoaderMetadata.context();
    metadata.hierarchy = [...metadata.hierarchy, ...currentContext.hierarchy];
  } catch {
    /* empty */
  }

  metadata.hierarchy = [...metadata.hierarchy, id];

  return async () =>
    LoaderMetadata.exit(async () =>
      AsyncContext.executeWith(LoaderMetadata, () => metadata, fn),
    );
}

export function canPropagateRetry(
  id: string,
  strategy: LoaderRetryPropagation,
) {
  let currentHierarchy: string[] = [];

  try {
    const { hierarchy } = LoaderMetadata.context();
    currentHierarchy = [...hierarchy];
  } catch {
    /* empty */
  }

  // check if strategy is "always propagate or not"
  if (typeof strategy === "boolean") {
    return strategy;
  }

  // HAS_OUTER_CONTEXT
  else if (strategy === "HAS_OUTER_CONTEXT") {
    return currentHierarchy.length > 1;
  }

  // HAS_SAME_OUTER_CONTEXT
  else if (strategy === "HAS_SAME_OUTER_CONTEXT") {
    if (currentHierarchy.length < 2) {
      return false;
    }

    return currentHierarchy[currentHierarchy.length - 2] === id;
  }

  // default to false
  return false;
}
