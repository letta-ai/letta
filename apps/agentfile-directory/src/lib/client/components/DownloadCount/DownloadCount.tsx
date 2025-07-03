import {
  BoltIcon,
  HStack,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';

interface DownloadCountProps {
  count: number;
}

export function DownloadCount(props: DownloadCountProps) {
  const { count } = props;
  const { formatShorthandNumber } = useFormatters();

  return (
    <HStack gap="small" align="center">
      <BoltIcon size="xsmall" color="lighter" />
      <Typography variant="body2">{formatShorthandNumber(count)}</Typography>
    </HStack>
  );
}
