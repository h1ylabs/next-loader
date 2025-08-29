import { ExternalResourceAdapter } from "../models/resourceAdapter";

export function createExternalResourceAdapter<
  ExternalResourceParam = unknown,
  ExternalResource = unknown,
>(adapter: ExternalResourceAdapter<ExternalResourceParam, ExternalResource>) {
  return adapter;
}
