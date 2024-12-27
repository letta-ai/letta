export async function generateAPIKey(organizationId: string) {
  const apiKey = crypto.randomUUID();

  return btoa(`${organizationId}:${apiKey}`);
}
