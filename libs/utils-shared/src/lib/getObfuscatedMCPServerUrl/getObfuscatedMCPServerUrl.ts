export function getObfuscatedMCPServerUrl(url: string) {
  // for now just show the base no pathname or search params

  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? `:${parsedUrl.port}` : ''}`;
  } catch (error) {
    console.error('Invalid URL:', url, error);
    return 'Invalid URL';
  }
}
