import { Typography, MarketingButton } from '@letta-web/component-library';

function LoginPage() {
  return (
    <div>
      <Typography variant="heading1">Sign in to Letta</Typography>
      <MarketingButton
        href="/auth/google/init"
        variant="primaryDark"
        label="Sign in with Google"
      />
    </div>
  );
}

export default LoginPage;
