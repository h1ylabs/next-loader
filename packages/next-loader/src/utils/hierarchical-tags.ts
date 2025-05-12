interface Resolver {
  prefix(): string;
  resolved(): string[];
}

export default function hierarchicalTags(...tags: string[]): string[] {
  const result = tags.reduce<Resolver>(
    (resovler, current) => ({
      prefix() {
        const previous = resovler.prefix();
        return previous ? [previous, current].join("/") : current;
      },

      resolved() {
        return [...resovler.resolved(), this.prefix()];
      },
    }),
    { prefix: () => "", resolved: () => [] },
  );

  return result.resolved();
}
