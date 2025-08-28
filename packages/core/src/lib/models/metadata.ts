export type LoaderContextID = object & {
  readonly __loaderContextID: unique symbol;
};

export type MetadataContext = {
  readonly contextID: LoaderContextID;
};

export type MetadataOptions = {
  readonly contextID: LoaderContextID;
};

export function createMetadataContext(): MetadataContext {
  return { contextID: {} as LoaderContextID };
}
