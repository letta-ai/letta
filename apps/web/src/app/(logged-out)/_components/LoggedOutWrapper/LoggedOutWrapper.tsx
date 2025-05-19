import { VStack } from '@letta-cloud/ui-component-library';

import { HStack } from '@letta-cloud/ui-component-library';

interface LoggedOutWrapperProps {
  children: React.ReactNode;
}

export function LoggedOutWrapper(props: LoggedOutWrapperProps) {
  const { children } = props;

  return (
    <HStack
      gap={false}
      // eslint-disable-next-line react/forbid-component-props
      className="login-container h-[100dvh]"
      fullHeight
    >
      <VStack
        zIndex="rightAboveZero"
        align="center"
        justify="center"
        fullHeight
        fullWidth
        color="background"
      >
        <VStack
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-full  max-w-[350px]"
          align="center"
          justify="center"
          padding
          color="background-grey"
        >
          {children}
        </VStack>
      </VStack>
    </HStack>
  );
}
