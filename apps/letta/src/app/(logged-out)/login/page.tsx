import { HStack, Frame, VStack } from '@letta-web/component-library';
import { LoginComponent } from './LoginComponent';

function LoginPage() {
  return (
    <HStack gap={false} className="h-[100vh]" fullHeight>
      <Frame fullWidth className="relative overflow-hidden">
        <img
          alt=""
          className="absolute w-[100vw] max-w-[100vw] aspect-auto"
          src="/img/login-bg.png"
        />
      </Frame>
      <VStack
        className="z-10 "
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
