import { cn } from '@letta-cloud/ui-styles';

interface CenterPageProps {
  children: React.ReactNode;
  className?: string;
}

export function CenterPage(props: CenterPageProps) {
  return (
    <div
      className={cn(
        'w-[100dvw] bg-white h-[100dvh] gap-4 fixed flex flex-col items-center justify-center',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
