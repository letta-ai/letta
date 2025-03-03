import * as React from 'react';
import { ExternalLinkIcon } from '../../icons';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
}

export function ExternalLink(props: ExternalLinkProps) {
  const { children, href } = props;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline"
    >
      {children}
      <ExternalLinkIcon />
    </a>
  );
}
