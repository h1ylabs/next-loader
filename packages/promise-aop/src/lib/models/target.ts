export type Target<Result> = () => Promise<Result>;
export type TargetWrapper<Result> = (target: Target<Result>) => Target<Result>;
