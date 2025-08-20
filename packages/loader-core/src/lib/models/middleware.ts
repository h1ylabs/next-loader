/* eslint-disable @typescript-eslint/no-explicit-any */
import { Aspect } from "@h1y/promise-aop";

export type LoaderMiddleware<Result, Context, MiddlewareName extends string> = {
  readonly name: MiddlewareName;
  readonly contextGenerator: () => Context;
  readonly aspect: Aspect<Result, any>;
};

export type MiddlewareOptions<
  Middlewares extends readonly LoaderMiddleware<any, unknown, string>[],
> = {
  [K in Middlewares[number] as K["name"]]: () => ReturnType<
    K["contextGenerator"]
  >;
};

export type MiddlewareContext<
  Middlewares extends readonly LoaderMiddleware<any, unknown, string>[],
> = {
  [K in Middlewares[number] as K["name"]]: K extends LoaderMiddleware<
    any,
    infer Context,
    any
  >
    ? Context
    : never;
};
