import { LoaderMiddleware } from "@h1y/loader-core";

export type ReactComponentLoaderMiddleware = LoaderMiddleware<
  React.ReactElement,
  unknown,
  string
>;
