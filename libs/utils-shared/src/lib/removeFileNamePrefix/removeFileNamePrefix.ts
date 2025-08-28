export function removeFileNamePrefix(filePath: string | null | undefined): string {
  if (!filePath) return '';
  return filePath.split('/').pop() || filePath;
}
