'use client';
import React from 'react';
import { ToolsPageLayout } from '../tools/_components/ToolsPageLayout/ToolsPageLayout';

interface ToolsLayoutProps {
  children: React.ReactNode;
}

export default function ToolsLayout(props: ToolsLayoutProps) {
  const { children } = props;


  return (
    <ToolsPageLayout>{children}</ToolsPageLayout>
  );
}
