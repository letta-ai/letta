import React from 'react';
import { Header } from '$afd/client/components/Header/Header';
import { VStack } from '@letta-cloud/ui-component-library';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VStack>
      <Header />
      <div className="h-[334px] absolute w-full z-[0] bg-background-grey2 agentheader-background"></div>
      <div className="largerThanMobile:px-[72px] px-4 w-full">{children}</div>
    </VStack>
  );
}
