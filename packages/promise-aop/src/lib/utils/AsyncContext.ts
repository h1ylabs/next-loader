import { AsyncLocalStorage } from "node:async_hooks";

export class AsyncContext<SharedContext> {
  private constructor(
    private readonly contextGenerator?: () => SharedContext,
    private readonly contextStore = new AsyncLocalStorage<SharedContext>(),
  ) {}

  private context = () => {
    const store = this.contextStore.getStore();

    if (!store) {
      throw new Error(MSG_ERR_ASYNC_CONTEXT_NOT_EXIST);
    }

    return store;
  };

  static async execute<P, Q>(
    { contextGenerator, contextStore, context }: AsyncContext<P>,
    operation: (context: AsyncContext<P>["context"]) => Promise<Q>,
  ): Promise<Q> {
    if (!contextGenerator) {
      throw new Error(MSG_ERR_ASYNC_CONTEXT_GENERATOR_NOT_PROVIDED);
    }

    return contextStore.run(contextGenerator(), async () => operation(context));
  }

  static async executeWith<P, Q>(
    { contextStore, context }: AsyncContext<P>,
    contextGenerator: () => P,
    operation: (context: AsyncContext<P>["context"]) => Promise<Q>,
  ): Promise<Q> {
    return contextStore.run(contextGenerator(), async () => operation(context));
  }

  static create<T>(contextGenerator?: () => T) {
    return new AsyncContext<T>(contextGenerator);
  }
}

/**
 * Error message constant used when attempting to access context outside of a context run.
 */
export const MSG_ERR_ASYNC_CONTEXT_NOT_EXIST = "async context not found";

/**
 * Error message constant used when attempting to execute an operation without a context generator.
 */
export const MSG_ERR_ASYNC_CONTEXT_GENERATOR_NOT_PROVIDED =
  "async context generator not provided";
