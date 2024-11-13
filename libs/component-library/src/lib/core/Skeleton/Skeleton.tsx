import { cn } from '@letta-web/core-style-config';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse bg-background-greyer', className)}
      {...props}
    />
  );
}
