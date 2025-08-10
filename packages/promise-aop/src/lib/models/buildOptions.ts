import {
  NormalizableOptions,
  normalizeOptions,
} from "../utils/normalizeOptions";
import type { Advice } from "./advice";

export type RequiredBuildOptions = {
  readonly advice: {
    readonly [advice in Advice]: {
      readonly execution: ExecutionStrategy;
      readonly error: {
        readonly aggregation: AggregationUnit;
        readonly runtime: {
          readonly afterThrow: ErrorAfter;
        };
      };
    };
  };
};

export const ExecutionStrategy = ["parallel", "sequential"] as const;
export type ExecutionStrategy = (typeof ExecutionStrategy)[number];

export const AggregationUnit = ["unit", "all"] as const;
export type AggregationUnit = (typeof AggregationUnit)[number];

export const ErrorAfter = ["halt", "continue"] as const;
export type ErrorAfter = (typeof ErrorAfter)[number];

export type BuildOptions = NormalizableOptions<RequiredBuildOptions>;

export function normalizeBuildOptions(
  options?: BuildOptions,
  defaultOptions: RequiredBuildOptions = defaultBuildOptions(),
): RequiredBuildOptions {
  return normalizeOptions(defaultOptions, options);
}

export function defaultBuildOptions() {
  return {
    advice: {
      before: {
        execution: "parallel",
        error: {
          aggregation: "unit",
          runtime: {
            // By default, the before phase halts immediately when an error occurs.
            // When set to 'continue' in the before phase, returns null as the result on error.
            afterThrow: "halt",
          },
        },
      },
      around: {
        execution: "sequential",
        error: {
          aggregation: "unit",
          runtime: {
            // When set to 'continue' in the around phase, returns null as the result on error.
            afterThrow: "halt",
          },
        },
      },
      after: {
        execution: "parallel",
        error: {
          aggregation: "all",
          runtime: {
            afterThrow: "continue",
          },
        },
      },
      afterReturning: {
        execution: "parallel",
        error: {
          aggregation: "all",
          runtime: {
            afterThrow: "continue",
          },
        },
      },
      afterThrowing: {
        execution: "parallel",
        error: {
          aggregation: "all",
          runtime: {
            afterThrow: "continue",
          },
        },
      },
    },
  } as const satisfies RequiredBuildOptions;
}
