import type {
  ContextAccessor,
  ExecutionOuterContext,
} from "@/lib/utils/AsyncContext";
import {
  type NormalizableOptions,
  normalizeOptions,
} from "@/lib/utils/normalizeOptions";

import type { ErrorInfo } from "./rejection";
import { Rejection } from "./rejection";

export type RequiredProcessOptions<Result, SharedContext> = {
  // determines which error to propagate from the collected errors.
  readonly determineError: (props: {
    context: ContextAccessor<SharedContext>;
    exit: ExecutionOuterContext;
    errors: unknown[];
    info: ErrorInfo;
  }) => Promise<unknown>;

  // handles an error based on a specific error.
  readonly handleError: (props: {
    context: ContextAccessor<SharedContext>;
    exit: ExecutionOuterContext;
    error: unknown;
  }) => Promise<Result>;

  // handles errors that were just passed over.
  readonly handleContinuedErrors: (props: {
    context: ContextAccessor<SharedContext>;
    exit: ExecutionOuterContext;
    errors: readonly (readonly [unknown[], ErrorInfo])[];
  }) => Promise<void>;
};

export type ProcessOptions<Result, SharedContext> = NormalizableOptions<
  RequiredProcessOptions<Result, SharedContext>
>;

export function normalizeProcessOptions<Result, SharedContext>(
  options?: ProcessOptions<Result, SharedContext>,
  defaultOptions: RequiredProcessOptions<
    Result,
    SharedContext
  > = defaultProcessOptions(),
): RequiredProcessOptions<Result, SharedContext> {
  return normalizeOptions(defaultOptions, options);
}

export function defaultProcessOptions<
  Result,
  SharedContext,
>(): RequiredProcessOptions<Result, SharedContext> {
  return {
    determineError: async ({ errors }) => {
      return errors[0];
    },
    handleError: async ({ error }) => {
      if (error instanceof Rejection) {
        throw error.errors[0];
      }
      throw error;
    },
    handleContinuedErrors: async () => {},
  };
}
