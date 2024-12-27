'use client';
import { HStack, VStack } from '@letta-web/component-library';
import { LoginComponent } from './LoginComponent';

function LoginPage() {
  return (
    // eslint-disable-next-line react/forbid-component-props
    <HStack gap={false} className="login-container h-[100dvh]" fullHeight>
      <VStack
        zIndex="rightAboveZero"
        color="background-black"
        align="center"
        justify="center"
        fullHeight
        fullWidth
      >
        <LoginComponent />
      </VStack>
    </HStack>
  );
}

export default LoginPage;
