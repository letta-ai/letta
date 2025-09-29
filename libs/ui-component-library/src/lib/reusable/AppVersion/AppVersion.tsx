import { Typography, VStack } from '@letta-cloud/ui-component-library';
import { environment } from '@letta-cloud/config-environment-variables';

export function AppVersion() {
  const gitHash = environment.NEXT_PUBLIC_GIT_HASH || '';

  return (
    <VStack paddingX="medium">
      <Typography color="muted" variant="body4">
        {gitHash ? `#${gitHash}` : ''}
      </Typography>
    </VStack>
  );
}
