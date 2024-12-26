import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { CookieNames } from '$web/server/cookies/types';

interface BodyProps {
  children: React.ReactNode;
}

export function Body(props: BodyProps) {
  const { children } = props;

  const theme = (cookies() as unknown as UnsafeUnwrappedCookies).get(
    CookieNames.THEME
  );

  return (
    <body className={theme?.value} data-mode={theme?.value}>
      <div className="min-h-[100dvh]">{children}</div>
    </body>
  );
}
