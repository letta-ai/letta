import { HStack, VStack } from '@letta-web/component-library';
import { LoginComponent } from './LoginComponent';

function LoginPage() {
  return (
    <HStack gap={false} className="login-container h-[100vh]" fullHeight>
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
