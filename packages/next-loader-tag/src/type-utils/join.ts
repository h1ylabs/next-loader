export type Join<
  Left extends string,
  Right extends string,
  Separator extends string,
> = Left extends ""
  ? Right
  : Right extends ""
    ? Left
    : `${Left}${Separator}${Right}`;
