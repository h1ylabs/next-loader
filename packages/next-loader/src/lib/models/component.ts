export type ComponentFunction<Props, Element> = (
  props: Props,
) => Promise<Element>;
