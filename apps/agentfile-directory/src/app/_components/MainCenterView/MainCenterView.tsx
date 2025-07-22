'use client';

interface MainCenterViewProps {
  children: React.ReactNode;
}

export function MainCenterView(props: MainCenterViewProps) {
  const { children } = props;

  return (
    <div className=" border max-w-[1296px] z-[1] w-full mt-[104px] mx-auto  relative bg-background">
      {children}
    </div>
  );
}
