import React from 'react';
import { Header } from '$afd/client/components/Header/Header';
import { VStack } from '@letta-cloud/ui-component-library';
import { DirectoryFooter } from '$afd/client/components/DirectoryFooter/DirectoryFooter';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="flex-grow">
        <Header />
        <div className="h-[334px] absolute w-full z-[0] bg-background-grey2 agentheader-background"></div>
        <div className="largerThanMobile:px-[72px] px-4 w-full">{children}</div>
      </VStack>
      <DirectoryFooter />
    </div>
  );
}
