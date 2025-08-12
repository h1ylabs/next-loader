import { createAspect } from "@/createAspect";
import {
  AsyncContext,
  createProcess,
  runProcess,
  TARGET_FALLBACK,
} from "@/index";
import type { AdviceChainContext } from "@/lib/features/chaining/context";
import type { Aspect, AspectOrganization } from "@/lib/models/aspect";
import type { BuildOptions } from "@/lib/models/buildOptions";
import { normalizeBuildOptions } from "@/lib/models/buildOptions";
import type {
  ProcessOptions,
  RequiredProcessOptions,
} from "@/lib/models/processOptions";
import { normalizeProcessOptions } from "@/lib/models/processOptions";
import type { Target, TargetWrapper } from "@/lib/models/target";

/**
 * Standard test context type for consistent testing across all test files
 */
export interface StandardTestContext {
  readonly log: {
    info: (msg: string) => void;
    error?: (msg: string) => void;
  };
  readonly database?: {
    query: (sql?: string) => Promise<void>;
    begin?: () => Promise<void>;
    commit?: () => Promise<void>;
    rollback?: () => Promise<void>;
  };
  readonly cache?: {
    get: (key?: string) => Promise<unknown>;
    set: (key?: string, value?: unknown) => Promise<void>;
  };
  readonly auth?: {
    check: () => Promise<boolean>;
    isAuthorized?: () => Promise<boolean>;
  };
  readonly aux?: { poke: () => void };
}

/**
 * Creates a unified chain context for testing advice chains
 */
export const createTestChain = <Result, SharedContext>(
  overrides: Partial<AdviceChainContext<Result, SharedContext>> = {},
): (() => AdviceChainContext<Result, SharedContext>) => {
  const state = {
    haltRejection: undefined,
    continueRejections: [] as unknown[],
    context: () => ({}) as SharedContext,
    target: (async () => "OK") as Target<Result>,
    advices: {
      before: jest.fn(async () => {}),
      around: jest.fn(async () => {}),
      afterReturning: jest.fn(async () => {}),
      afterThrowing: jest.fn(async () => {}),
      after: jest.fn(async () => {}),
    },
    buildOptions: normalizeBuildOptions(),
    processOptions: normalizeProcessOptions<Result, SharedContext>(),
    ...overrides,
  } as AdviceChainContext<Result, SharedContext>;

  return () => state;
};

/**
 * Creates a standard test context instance
 */
export const createStandardTestContext = (
  overrides: Partial<StandardTestContext> = {},
): StandardTestContext => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
  },
  database: {
    query: jest.fn(),
    begin: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
  },
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
  auth: {
    check: jest.fn().mockResolvedValue(true),
    isAuthorized: jest.fn().mockResolvedValue(true),
  },
  ...overrides,
});

/**
 * Creates a logging context that collects messages in an array
 */
export const createLoggingContext =
  (calls: string[] = []) =>
  (): StandardTestContext => ({
    log: { info: (msg: string) => calls.push(msg) },
  });

/**
 * Creates a reusable logging aspect for testing
 */
export const createLoggingTestAspect = <Result>(
  name = "logging",
): Aspect<Result, StandardTestContext> =>
  createAspect<Result, StandardTestContext>((createAdvice) => ({
    name,
    before: createAdvice({
      use: ["log"],
      advice: async ({ log }) => log.info("before"),
    }),
    around: createAdvice({
      use: ["log"],
      advice: async ({ log }, { attachToTarget }) => {
        attachToTarget((target) => async () => {
          log.info("around:before");
          const result = await target();
          log.info("around:after");
          return result;
        });
      },
    }),
    afterReturning: createAdvice({
      use: ["log"],
      advice: async ({ log }) => log.info("afterReturning"),
    }),
    afterThrowing: createAdvice({
      use: ["log"],
      advice: async ({ log }, error) =>
        log.info(`afterThrowing: ${String(error)}`),
    }),
    after: createAdvice({
      use: ["log"],
      advice: async ({ log }) => log.info("after"),
    }),
  }));

/**
 * Creates a failing aspect for error testing
 */
export const createFailingTestAspect = <Result>(
  name = "failing",
  phase: keyof Aspect<Result, StandardTestContext> = "before",
  errorMessage = "test error",
): Aspect<Result, StandardTestContext> =>
  createAspect<Result, StandardTestContext>((createAdvice) => ({
    name,
    [phase]: createAdvice({
      advice: async () => {
        throw new Error(errorMessage);
      },
    }),
  }));

/**
 * Creates a simple target function for testing
 */
export const createCommonTarget =
  <Result>(value: Result): Target<Result> =>
  async () =>
    value;

/**
 * Creates a failing target function for testing
 */
export const createFailingTestTarget =
  <Result>(errorMessage = "target failed"): Target<Result> =>
  async () => {
    throw new Error(errorMessage);
  };

/**
 * Creates a target that throws the given error instance (preserves object identity)
 */
export const createThrowingTestTarget =
  <Result>(error: unknown): Target<Result> =>
  async () => {
    throw error;
  };

/**
 * Creates a simple id/data context factory used across chaining tests
 */
export const createIdDataContext =
  (id: string = "test", data: number = 42) =>
  () => ({ id, data });

/**
 * Creates a default mock advices object, allowing selective overrides
 */
export const createCommonAdvices = <Result, SharedContext>(
  overrides: Partial<AspectOrganization<Result, SharedContext>> = {},
): AspectOrganization<Result, SharedContext> => ({
  before: jest.fn(),
  around: jest.fn(),
  afterReturning: jest.fn(),
  afterThrowing: jest.fn(),
  after: jest.fn(),
  ...overrides,
});

/**
 * Creates a mocked RequiredProcessOptions with jest fns, allowing overrides
 */
export const createProcessOptionsMock = <Result, SharedContext>(
  overrides: Partial<RequiredProcessOptions<Result, SharedContext>> = {},
): RequiredProcessOptions<Result, SharedContext> => ({
  resolveHaltRejection: jest
    .fn()
    .mockResolvedValue(() =>
      Promise.reject(new Error("Default mock - should be overridden in tests")),
    ),
  resolveContinuousRejection: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

// Runner helper to reduce boilerplate
export async function runWith<Result, Ctx>(
  aspects: readonly Aspect<Result, Ctx>[],
  opts: {
    context: (() => Ctx) | AsyncContext<Ctx>;
    target: Target<Result>;
    buildOptions?: BuildOptions;
    processOptions?: ProcessOptions<Result, Ctx>;
  },
) {
  const process = createProcess<Result, Ctx>({
    aspects,
    buildOptions: opts.buildOptions,
    processOptions: opts.processOptions,
  });
  return runProcess({ process, context: opts.context, target: opts.target });
}

// Standard fallback process options for tests
export const createFallbackProcessOptions = <Result, SharedContext>() =>
  createProcessOptionsMock<Result, SharedContext>({
    resolveHaltRejection: jest
      .fn()
      .mockResolvedValue(async () => TARGET_FALLBACK),
    resolveContinuousRejection: jest.fn().mockResolvedValue(undefined),
  });

// Wrapper builders for around advice tests
export const wrapTargetWithLogs =
  <R>(
    log: { info: (s: string) => void },
    label: string,
    map: (r: R) => R = (r) => r,
  ): TargetWrapper<R> =>
  (target) =>
  async () => {
    log.info(`${label}-start`);
    const r = await target();
    log.info(`${label}-end`);
    return map(r);
  };

export const wrapResultWithLogs = wrapTargetWithLogs;

// Small async delay helper for stable async tests
export const delay = (ms = 1) => new Promise((res) => setTimeout(res, ms));

// Log order helper
export const pickOrder = (calls: string[], token: string) =>
  calls.filter((c) => c.includes(token));
