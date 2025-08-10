// 2 params
export function pipeAsync<A, B>(
  ab: (a: A) => Promise<B> | B,
): (a: A) => Promise<B>;

// 3 params
export function pipeAsync<A, B, C>(
  ab: (a: A) => Promise<B> | B,
  bc: (b: B) => Promise<C> | C,
): (a: A) => Promise<C>;

// 4 params
export function pipeAsync<A, B, C, D>(
  ab: (a: A) => Promise<B> | B,
  bc: (b: B) => Promise<C> | C,
  cd: (c: C) => Promise<D> | D,
): (a: A) => Promise<D>;

// 5 params
export function pipeAsync<A, B, C, D, E>(
  ab: (a: A) => Promise<B> | B,
  bc: (b: B) => Promise<C> | C,
  cd: (c: C) => Promise<D> | D,
  de: (d: D) => Promise<E> | E,
): (a: A) => Promise<E>;

export function pipeAsync(...fns: ((arg: unknown) => unknown)[]) {
  return async (arg: unknown) => {
    let result = arg;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };
}
