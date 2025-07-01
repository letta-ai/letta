'use client';
import { SystemAlert } from '../SystemAlert/SystemAlert';

interface BodyProps {
  children: React.ReactNode;
}

export function Body(props: BodyProps) {
  const { children } = props;

  return (
    <body>
      <div className="min-h-[100dvh]">
        <SystemAlert></SystemAlert>
        {children}
      </div>
    </body>
  );
}
