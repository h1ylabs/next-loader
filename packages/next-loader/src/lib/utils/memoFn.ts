/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export type MemoFunction = <Fn extends Function>(fn: Fn) => Fn;
