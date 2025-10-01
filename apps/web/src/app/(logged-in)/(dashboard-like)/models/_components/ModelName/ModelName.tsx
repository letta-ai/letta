import {
  brandKeyToLogo,
  HStack,
  isBrandKey,
  Typography,
} from '@letta-cloud/ui-component-library';

interface ModelNameProps {
  modelName: string;
  brand: string;
}

export function ModelName(props: ModelNameProps) {
  const { modelName, brand } = props;

  return (
    <HStack align="center" gap="medium">
      {isBrandKey(brand) ? brandKeyToLogo(brand) : ''}
      <Typography variant="body2" bold>
        {modelName}
      </Typography>
    </HStack>
  );
}
