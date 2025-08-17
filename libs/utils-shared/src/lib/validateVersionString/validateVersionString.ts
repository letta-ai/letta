export type VersionStringWithProject = `${string}/${string}:${string}`;


export function validateVersionString(versionString: string): versionString is VersionStringWithProject {
  // Check if the version string matches the expected format
  const regex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+:[a-zA-Z0-9._-]+$/;
  return regex.test(versionString);
}
