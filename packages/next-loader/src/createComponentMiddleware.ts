import { middleware } from "@h1y/loader-core";

export const createComponentMiddleware =
  middleware<React.ReactElement>().withOptions;
