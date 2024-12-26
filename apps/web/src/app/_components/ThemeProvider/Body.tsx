import { cookies } from 'next/headers';
import { CookieNames } from '$web/server/cookies/types';

interface BodyProps {
  children: React.ReactNode;
}

export async function Body(props: BodyProps) {
  const { children } = props;

  const theme = (await cookies()).get(CookieNames.THEME);

  return (
    <body className={theme?.value} data-mode={theme?.value}>
      <div className="min-h-[100dvh]">{children}</div>
    </body>
  );
}
