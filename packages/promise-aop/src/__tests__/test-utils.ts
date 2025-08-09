import { createAspect } from "@/createAspect";
import type { AdviceChainContext } from "@/lib/features/chaining/context";
import type { Aspect } from "@/lib/models/aspect";
import { normalizeBuildOptions } from "@/lib/models/buildOptions";
import { normalizeProcessOptions } from "@/lib/models/processOptions";
import type { Target } from "@/lib/models/target";

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
    processOptions: normalizeProcessOptions<Result>(),
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
      advice: async ({ log }, wrap) => {
        wrap((target) => async () => {
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
export const createTestTarget =
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
