import * as React from 'react';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';
import { VStack } from '../../framing/VStack/VStack';

export function LettaLoaderPanel() {
  return (
    <VStack padding fullWidth collapseHeight align="center" justify="center">
      <LettaLoader variant="grower" size="large" />
    </VStack>
  );
}
