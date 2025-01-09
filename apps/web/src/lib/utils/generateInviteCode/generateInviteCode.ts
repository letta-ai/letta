interface GenerateInviteCodeOptions {
  email: string;
  organizationId: string;
}

const splitter = '%_%';

export function generateInviteCode(options: GenerateInviteCodeOptions) {
  // email + organizationId + random bytes + timestamp all hashed
  const randomValue = Math.random().toString(36).substring(2, 15);
  const unhashed = `${options.email}${splitter}${options.organizationId}${splitter}${randomValue}${splitter}${Date.now()}`;

  return btoa(unhashed);
}

export function parseInviteCode(inviteCode: string) {
  const parts = atob(inviteCode).split(splitter);

  const timestamp = parts.length === 4 ? parts[parts.length - 1] : null;

  const isExpired = timestamp
    ? Date.now() - parseInt(timestamp, 10) > 1000 * 60 * 60 * 24 * 7
    : true;

  return {
    email: parts[0],
    organizationId: parts[1],
    wholeCode: inviteCode,
    timestamp,
    // if the invite code is older than 7 days, it is considered expired
    isExpired: isExpired,
    expiresIn: timestamp
      ? 1000 * 60 * 60 * 24 * 7 -
        (Date.now() - parseInt(parts[parts.length - 1], 10))
      : 0,
  };
}
