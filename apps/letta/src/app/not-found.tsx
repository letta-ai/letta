import {
  Button,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-web/component-library';

export default function NotFound() {
  return (
    <div className="w-screen h-screen">
      <VStack fullHeight fullWidth align="center" justify="center">
        <LoadingEmptyStatusComponent
          emptyMessage="This is not the page you're looking for"
          emptyAction={<Button label="Go home" href="/" />}
        />
      </VStack>
    </div>
  );
}
