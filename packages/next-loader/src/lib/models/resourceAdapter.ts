export type ExternalResourceAdapter<
  ExternalResourceParam = unknown,
  ExternalResponse = unknown,
> = (props: { tags: readonly string[]; options: ExternalResourceOptions }) => {
  validate?: (param: ExternalResourceParam) => void;
  load: (param: ExternalResourceParam) => Promise<ExternalResponse>;
};

export type ExternalResourceOptions = {
  staleTime?: number;
};
