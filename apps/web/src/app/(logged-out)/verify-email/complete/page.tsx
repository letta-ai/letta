import {
  Button,
  LoadingEmptyStatusComponent,
} from '@letta-cloud/ui-component-library';

export default function FailedVerifyEmailPage() {
  return (
    <LoadingEmptyStatusComponent
      isError
      errorMessage="Success! Your email has been verified! You can close this page."
      errorAction={<Button label="Go home" href="/" />}
    />
  );
}
