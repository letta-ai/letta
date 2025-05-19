import {
  Button,
  LoadingEmptyStatusComponent,
} from '@letta-cloud/ui-component-library';

export default function FailedVerifyEmailPage() {
  return (
    <LoadingEmptyStatusComponent
      isError
      errorMessage="We were unable to verify your email address, this could be that your code has expired or you are verifying an email that is not associated with your account."
      errorAction={<Button label="Go home" href="/" />}
    />
  );
}
