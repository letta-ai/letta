'use client';
import {
  Typography,
  BoltIcon,
  HStack,
} from '@letta-cloud/ui-component-library';

interface DownloadCountProps {
  downloadCount: number;
}

export function DownloadCount(props: DownloadCountProps) {
  const { downloadCount } = props;

  return (
    <HStack gap="small" align="center">
      <BoltIcon color="lighter" size="xsmall" />
      <Typography variant="body2" color="lighter">
        {downloadCount}
      </Typography>
    </HStack>
  );
}
