import { middleware } from "@h1y/loader-core";

export type ComponentStateContext = {
  data: unknown[];
  currentIndex: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatchers: (((prev: any) => any) | (() => any))[][];
};

export type InitialValue<T> = T extends (...args: never) => unknown
  ? never
  : T | (() => T);

export const ComponentStateMiddleware = <Element>() =>
  middleware<Element>().withOptions({
    name: "state",
    contextGenerator: (): ComponentStateContext => ({
      data: [],
      dispatchers: [],
      currentIndex: 0,
    }),

    async before(context) {
      // update the data with the dispatchers
      context.data = context.data.map((value, index) =>
        context.dispatchers[index]?.reduce(
          (result, dispatcher) => dispatcher(result),
          value,
        ),
      );

      // cleanup before work - dispatchers array must match data length
      context.currentIndex = 0;
      context.dispatchers = Array(context.data.length)
        .fill(null)
        .map(() => []);
    },
  });

export function createComponentState<T>(
  context: () => ComponentStateContext,
  initialValue?: InitialValue<T>,
) {
  // reserve a slot in the store for this state
  const storeIndex = context().currentIndex++;

  // ensure dispatchers array has correct length
  if (!context().dispatchers[storeIndex]) {
    context().dispatchers[storeIndex] = [];
  }

  // initialize state data if not already present
  if (context().data[storeIndex] === undefined) {
    context().data[storeIndex] = resolveInitialValue(initialValue);
  }

  const currentState = context().data[storeIndex] as T | null;

  const setState = (state: Dispatch<T>) => {
    context().dispatchers[storeIndex]?.push(resolveDispatch(state));
  };

  // Validate store consistency
  validateStoreConsistency(context());

  return [currentState, setState] as const;
}

export function resolveInitialValue<T>(
  initialValue?: InitialValue<T>,
): T | null {
  if (!initialValue) {
    return null;
  }

  // if initial value is a function, call it once to get the value
  if (typeof initialValue === "function") {
    return (initialValue as () => T)();
  }

  return initialValue as T;
}

export function resolveDispatch<T>(dispatch: Dispatch<T>): (prev: T) => T {
  if (typeof dispatch === "function") {
    return dispatch as (prev: T) => T;
  }

  // return a function that ignores previous value and returns the new value
  return () => dispatch as T;
}

export function validateStoreConsistency(context: {
  currentIndex: number;
  data: unknown[];
  dispatchers: unknown[][];
}): void {
  // data and dispatchers arrays must have the same length
  // currentIndex should not exceed data length
  const isConsistent =
    context.data.length === context.dispatchers.length &&
    context.currentIndex <= context.data.length;

  if (!isConsistent) {
    throw new Error(
      MSG_ERR_STORE_CONSISTENCY_VIOLATION(
        context.currentIndex,
        context.data.length,
        context.dispatchers.length,
      ),
    );
  }
}

export type Dispatch<T> = T extends (...args: never) => unknown
  ? never
  : T | ((prev: T) => T);

export const MSG_ERR_STORE_CONSISTENCY_VIOLATION = (
  currentIndex: number,
  dataLength: number,
  dispatchersLength: number,
) =>
  `store consistency violation: currentIndex=${currentIndex}, ` +
  `data.length=${dataLength}, dispatchers.length=${dispatchersLength}`;
