import { LoaderMiddleware } from "@h1ylabs/loader-core";

export type ReactComponentLoaderMiddleware = LoaderMiddleware<
  React.ReactElement,
  unknown,
  string
>;
