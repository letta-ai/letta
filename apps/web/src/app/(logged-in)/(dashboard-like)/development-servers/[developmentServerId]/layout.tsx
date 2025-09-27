'use server';
import React from 'react';
import { DevelopmentServerWrapper } from './components/DevelopmentServerWrapper/DevelopmentServerWrapper';

interface LocalServiceLayoutProps {
  children: React.ReactNode;
}

async function LocalServiceLayout(props: LocalServiceLayoutProps) {
  const { children } = props;

  return <DevelopmentServerWrapper>{children}</DevelopmentServerWrapper>;
}

export default LocalServiceLayout;
