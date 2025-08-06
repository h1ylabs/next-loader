import CommitFunction from "@commitlint/cli/commit";

export default {
  ...CommitFunction,
  getVersionMessage,
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
