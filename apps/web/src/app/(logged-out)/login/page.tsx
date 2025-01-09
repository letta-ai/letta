'use client';
import { HStack, VStack } from '@letta-cloud/component-library';
import { LoginComponent } from './LoginComponent';

function LoginPage() {
  return (
    // eslint-disable-next-line react/forbid-component-props
    <HStack gap={false} className="h-[100dvh]" fullHeight>
      <VStack
        zIndex="rightAboveZero"
        align="center"
        justify="center"
        fullHeight
        fullWidth
        color="background"
      >
        <LoginComponent />
      </VStack>
    </HStack>
  );
}

export default LoginPage;
