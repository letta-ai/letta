'use client';
import { LoginComponent } from './LoginComponent';
import { LoggedOutWrapper } from '../_components/LoggedOutWrapper/LoggedOutWrapper';

function LoginPage() {
  return (
    <LoggedOutWrapper>
      <LoginComponent />
    </LoggedOutWrapper>
  );
}

export default LoginPage;
