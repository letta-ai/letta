import { cn } from '@letta-cloud/ui-styles';

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
