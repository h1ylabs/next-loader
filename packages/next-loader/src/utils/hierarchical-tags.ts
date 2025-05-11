export default function hierarchicalTags(...tags: string[]): string[] {
  if (tags.length <= 1) return tags;

  const [prefix, ...rest] = tags;

  return [
    prefix!,
    ...hierarchicalTags(...rest).map((tag) => `${prefix}/${tag}`),
  ];
}
