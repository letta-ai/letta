import { cn } from '@letta-cloud/core-style-config';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse bg-background-grey2', className)}
      {...props}
    />
  );
}
