export type ResourceAdapter<
  LoaderParam = unknown,
  Response = unknown,
> = (props: {
  // 캐시에 필요한 태그이다.
  tags: readonly string[];
  // 기타 옵션이다. (staleTime)
  options: ResourceOptions;
}) => (param: LoaderParam) => Promise<Response>;

export type ResourceOptions = {
  staleTime?: number;
};
