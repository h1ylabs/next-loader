// from: https://github.com/changesets/changesets/blob/main/packages/cli/src/commit/index.ts
const getAddMessage = async (changeset) => {
  return `docs(changeset): ${changeset.summary}`;
};

const getVersionMessage = async (releasePlan) => {
  const publishableReleases = releasePlan.releases.filter(
    (release) => release.type !== "none",
  );
  const numPackagesReleased = publishableReleases.length;

  const releasesLines = publishableReleases
    .map((release) => `  ${release.name}@${release.newVersion}`)
    .join("\n");

  return `release: ${numPackagesReleased} version package(s)\n\nReleases:\n${releasesLines}`;
};

export default {
  getAddMessage,
  getVersionMessage,
};
